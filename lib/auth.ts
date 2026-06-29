import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

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
    // If userId is missing (legacy sessions sealed before multi-tenant), look it up from user table by email.
    let userId = data.userId;
    if (userId == null) {
      try {
        const sqlite = db().$client;
        const row = sqlite.prepare(`SELECT id FROM user WHERE LOWER(email) = ?`).get(data.email.toLowerCase()) as { id: number } | undefined;
        userId = row?.id ?? 1; // fallback to legacy single-tenant Julien
      } catch { userId = 1; }
    }
    return { userId, email: data.email, iat: data.iat };
  } catch {
    return null;
  }
}

export async function setSession(email: string, userId?: number) {
  let uid = userId;
  if (uid == null) {
    try {
      const sqlite = db().$client;
      const row = sqlite.prepare(`SELECT id FROM user WHERE LOWER(email) = ?`).get(email.toLowerCase()) as { id: number } | undefined;
      uid = row?.id ?? 1;
    } catch { uid = 1; }
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
  // 1) Try user table first (multi-tenant)
  try {
    const sqlite = db().$client;
    const row = sqlite.prepare(`SELECT id, hash FROM user WHERE LOWER(email) = ?`).get(lower) as { id: number; hash: string } | undefined;
    if (row) {
      const ok = await bcrypt.compare(pwd, row.hash);
      return ok ? { ok: true, userId: row.id } : { ok: false };
    }
  } catch {}
  // 2) Fallback to legacy auth.json (Julien-only original account)
  try {
    const c = readCredsFresh();
    if (lower !== c.email.toLowerCase()) return { ok: false };
    const ok = await bcrypt.compare(pwd, c.hash);
    if (!ok) return { ok: false };
    // Auto-migrate Julien into user table on first successful login if not present
    try {
      const sqlite = db().$client;
      const existing = sqlite.prepare(`SELECT id FROM user WHERE LOWER(email) = ?`).get(lower) as { id: number } | undefined;
      if (existing) return { ok: true, userId: existing.id };
      sqlite.prepare(`INSERT INTO user (id, email, hash, secret, role) VALUES (1, ?, ?, ?, 'owner') ON CONFLICT DO NOTHING`).run(c.email, c.hash, c.secret);
      return { ok: true, userId: 1 };
    } catch { return { ok: true, userId: 1 }; }
  } catch { return { ok: false }; }
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
export function hasActiveLink(viewerId: number, subjectId: number): boolean {
  try {
    const sqlite = db().$client;
    return !!sqlite.prepare(`SELECT 1 FROM household_link WHERE viewer_user_id = ? AND subject_user_id = ? AND status = 'active'`).get(viewerId, subjectId);
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
  return hasActiveLink(s.userId, subjectId) ? subjectId : s.userId; // fail-closed to self
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
    canView = db().$client.prepare(`
      SELECT h.subject_user_id AS id, COALESCE(h.label, u.email) AS label, u.email AS email
      FROM household_link h JOIN user u ON u.id = h.subject_user_id
      WHERE h.viewer_user_id = ? AND h.status = 'active' ORDER BY label
    `).all(s.userId) as Array<{ id: number; label: string; email: string }>;
  } catch { /* table may not exist yet */ }
  return { selfId: s.userId, selfEmail: s.email, viewingId, viewingSelf: viewingId === s.userId, canView };
}


/**
 * Helper: check whether a userId is the seeded demo user (Marie Dupont).
 * Used by write-routes to enforce read-only behaviour in demo mode.
 */
export function isDemoUser(userId: number | null | undefined): boolean {
  return userId === 999;
}
