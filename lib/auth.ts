import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

const COOKIE = "vitals_session";
const ACTIVE_COOKIE = "vitals_active";
const TTL = 60 * 60 * 24 * 30; // 30 days
const IDLE_TTL = 60 * 15; // 15 minutes

export type Session = { userId: number; email: string; iat: number };

type Creds = { email: string; hash: string; secret: string; totpSecret?: string | null; anonymizeLLM?: boolean };
let _creds: Creds | null = null;

function credsPath(): string {
  return process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
}

function loadCreds(): Creds {
  if (_creds) return _creds;
  const p = credsPath();
  if (!fs.existsSync(p)) {
    throw new Error(`Credentials file not found at ${p}. Run: node scripts/init_auth.mjs`);
  }
  _creds = JSON.parse(fs.readFileSync(p, "utf8"));
  return _creds!;
}

export function reloadCreds() {
  _creds = null;
  loadCreds();
}

export function readCredsFresh(): Creds {
  const p = credsPath();
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeCreds(update: Partial<Creds>) {
  const p = credsPath();
  const c = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(c, update);
  fs.writeFileSync(p, JSON.stringify(c, null, 2), "utf8");
  _creds = c;
}

function password(): string {
  const c = loadCreds();
  if (!c.secret || c.secret.length < 32) throw new Error("secret must be >=32 chars");
  return c.secret;
}

type RawSession = { userId?: number; email: string; iat: number };

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const tok = c.get(COOKIE)?.value;
  if (!tok) return null;
  try {
    const data = await unsealData<RawSession>(tok, { password: password(), ttl: TTL });
    if (!data?.email) return null;
    // If userId is missing (legacy sessions sealed before multi-tenant), look it
    // up by email. This resolution now FAILS CLOSED: it used to default to
    // userId 1, which meant that any session it could not resolve — including
    // during a transient backend error — was handed the owner's account and all
    // of its health data. An unresolvable session is simply not authenticated.
    let userId = data.userId;
    if (userId == null) {
      try {
        const { id } = await convexServer().query(api.users.idByEmail, {
          secret: bridgeSecret(), email: data.email.toLowerCase(),
        });
        if (id == null) return null;
        userId = id;
      } catch { return null; }
    }
    return { userId, email: data.email, iat: data.iat };
  } catch {
    return null;
  }
}

export async function setSession(email: string, userId?: number) {
  let uid = userId;
  if (uid == null) {
    // Fails closed for the same reason as getSession: sealing a session with a
    // guessed userId of 1 would mint a valid cookie for the owner's account.
    const { id } = await convexServer().query(api.users.idByEmail, {
      secret: bridgeSecret(), email: email.toLowerCase(),
    });
    if (id == null) throw new Error(`setSession: no user for ${email}`);
    uid = id;
  }
  const tok = await sealData({ userId: uid, email: email.toLowerCase(), iat: Date.now() }, { password: password(), ttl: TTL });
  const c = await cookies();
  c.set(COOKIE, tok, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: TTL });
  c.set(ACTIVE_COOKIE, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: IDLE_TTL });
}

export async function refreshActive() {
  const c = await cookies();
  c.set(ACTIVE_COOKIE, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: IDLE_TTL });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
  c.delete(ACTIVE_COOKIE);
}

export async function verifyCredentials(email: string, pwd: string): Promise<{ ok: boolean; userId?: number }> {
  const lower = email.toLowerCase();
  // 1) The user table is the source of truth.
  //
  // A backend failure here must NOT fall through to step 2: that fallback only
  // compares against the owner's credentials in auth.json, so swallowing the
  // error would silently narrow the whole login surface to a single account.
  // Let it throw and return a 500 rather than answer wrongly.
  const { user } = await convexServer().query(api.users.byEmail, {
    secret: bridgeSecret(), email: lower,
  });
  if (user) {
    const ok = await bcrypt.compare(pwd, user.hash);
    return ok ? { ok: true, userId: user.id } : { ok: false };
  }

  // 2) Bootstrap path for the original single-tenant owner account, kept for the
  //    case where the user table is empty (fresh install from auth.json).
  let creds: Creds;
  try {
    creds = readCredsFresh();
  } catch {
    return { ok: false };
  }
  if (lower !== creds.email.toLowerCase()) return { ok: false };
  if (!(await bcrypt.compare(pwd, creds.hash))) return { ok: false };

  const { id } = await convexServer().mutation(api.users.create, {
    secret: bridgeSecret(),
    email: creds.email,
    hash: creds.hash,
    userSecret: creds.secret,
    role: "owner",
  });
  return { ok: true, userId: id };
}

export function getTotpSecret(): string | null {
  return readCredsFresh().totpSecret || null;
}

export function hasTotpEnabled(): boolean {
  const s = getTotpSecret();
  return !!(s && s.length > 0);
}

/**
 * Helper: get the current user id from a session, or null if not authenticated.
 * Use in API routes: `const userId = await currentUserId(); if (!userId) return 401;`
 */
export async function currentUserId(): Promise<number | null> {
  const s = await getSession();
  return s?.userId ?? null;
}

const VIEW_COOKIE = "vitals_view";

/** True iff `viewerId` has an active, consented link to read `subjectId`. */
export async function hasActiveLink(viewerId: number, subjectId: number): Promise<boolean> {
  try {
    const { active } = await convexServer().query(api.household.hasActiveLink, {
      secret: bridgeSecret(), viewerId, subjectId,
    });
    return active;
  } catch { return false; }
}

/**
 * The user whose data should be READ: the authenticated account, or a household
 * member they're actively viewing — validated against an active, consented link
 * on EVERY call (a spoofed cookie with no active link falls back to self).
 * WRITES must keep using currentUserId() so "viewing" is read-only by design.
 */
export async function effectiveUserId(): Promise<number | null> {
  const s = await getSession();
  if (!s) return null;
  const c = await cookies();
  const raw = c.get(VIEW_COOKIE)?.value;
  const subjectId = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(subjectId) || subjectId === s.userId) return s.userId;
  return (await hasActiveLink(s.userId, subjectId)) ? subjectId : s.userId; // fail-closed to self
}

export async function setViewUser(subjectId: number) {
  const c = await cookies();
  c.set(VIEW_COOKIE, String(subjectId), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: TTL });
}

export async function clearViewUser() {
  const c = await cookies();
  c.delete(VIEW_COOKIE);
}

/** Switcher context for the UI: self, who's being viewed, and viewable members. */
export async function getViewContext(): Promise<{
  selfId: number; selfEmail: string; viewingId: number; viewingSelf: boolean;
  canView: Array<{ id: number; label: string; email: string }>;
} | null> {
  const s = await getSession();
  if (!s) return null;
  const viewingId = (await effectiveUserId()) ?? s.userId;
  let canView: Array<{ id: number; label: string; email: string }> = [];
  try {
    canView = (await convexServer().query(api.household.canView, { secret: bridgeSecret(), userId: s.userId })).rows;
  } catch { /* best-effort */ }
  return { selfId: s.userId, selfEmail: s.email, viewingId, viewingSelf: viewingId === s.userId, canView };
}


/**
 * Helper: check whether a userId is the seeded demo user (Marie Dupont).
 * Used by write-routes to enforce read-only behaviour in demo mode.
 */
export function isDemoUser(userId: number | null | undefined): boolean {
  return userId === 999;
}
