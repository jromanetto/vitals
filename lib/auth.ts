import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const COOKIE = "vitals_session";
const ACTIVE_COOKIE = "vitals_active";
const TTL = 60 * 60 * 24 * 30; // 30 days
const IDLE_TTL = 60 * 15; // 15 minutes

export type Session = { email: string; iat: number };

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

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const tok = c.get(COOKIE)?.value;
  if (!tok) return null;
  try {
    const data = await unsealData<Session>(tok, { password: password(), ttl: TTL });
    return data;
  } catch {
    return null;
  }
}

export async function setSession(email: string) {
  const tok = await sealData({ email: email.toLowerCase(), iat: Date.now() }, { password: password(), ttl: TTL });
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

export async function verifyCredentials(email: string, pwd: string): Promise<boolean> {
  const c = readCredsFresh();
  if (email.toLowerCase() !== c.email.toLowerCase()) return false;
  return bcrypt.compare(pwd, c.hash);
}

export function getTotpSecret(): string | null {
  return readCredsFresh().totpSecret || null;
}

export function hasTotpEnabled(): boolean {
  const s = getTotpSecret();
  return !!(s && s.length > 0);
}
