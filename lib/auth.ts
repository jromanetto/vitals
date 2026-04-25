import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const COOKIE = "vitals_session";
const TTL = 60 * 60 * 24 * 30; // 30 days

export type Session = { email: string; iat: number };

type Creds = { email: string; hash: string; secret: string };
let _creds: Creds | null = null;

function loadCreds(): Creds {
  if (_creds) return _creds;
  const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
  if (!fs.existsSync(p)) {
    throw new Error(`Credentials file not found at ${p}. Run: node scripts/init_auth.mjs`);
  }
  _creds = JSON.parse(fs.readFileSync(p, "utf8"));
  return _creds!;
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
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function verifyCredentials(email: string, pwd: string): Promise<boolean> {
  const c = loadCreds();
  if (email.toLowerCase() !== c.email.toLowerCase()) return false;
  return bcrypt.compare(pwd, c.hash);
}
