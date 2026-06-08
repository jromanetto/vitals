import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { readCredsFresh } from "@/lib/auth";
import { rateLimitByIp, extractIp } from "@/lib/lockout";
import { sendEmail, passwordResetTemplate } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const APP_URL = "https://vitals.club";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Does this email belong to a real account (user table or legacy owner)? */
function accountExists(sqlite: ReturnType<typeof db>["$client"], email: string): boolean {
  const row = sqlite.prepare(`SELECT 1 FROM user WHERE LOWER(email) = ?`).get(email);
  if (row) return true;
  try {
    const c = readCredsFresh();
    if (c.email && c.email.toLowerCase() === email) return true;
  } catch {}
  return false;
}

export async function POST(req: Request) {
  // Rate limit: 5 reset requests per IP / 15 min, block 15 min.
  const ip = extractIp(req);
  const rl = rateLimitByIp(ip, "forgot_password", 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de demandes. Réessaye dans quelques minutes." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  ensureSchema();
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email || "").trim().toLowerCase();

  // Always respond the same way so this endpoint can't be used to discover
  // which emails have accounts (anti-enumeration).
  const generic = NextResponse.json({ ok: true });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic;

  const sqlite = db().$client;
  if (!accountExists(sqlite, email)) {
    logAudit("password_reset_request_unknown", `email=${email}`, req);
    return generic;
  }

  // Invalidate any previous unused tokens for this email, then issue a fresh one.
  sqlite.prepare(`UPDATE password_reset SET used = 1 WHERE email = ? AND used = 0`).run(email);
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = Date.now() + TTL_MS;
  sqlite.prepare(`INSERT INTO password_reset (email, token_hash, expires_at) VALUES (?, ?, ?)`).run(email, tokenHash, expiresAt);

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await sendEmail({ to: email, ...passwordResetTemplate(resetUrl) }).catch((e) => console.error("[forgot-password] email", e));
  logAudit("password_reset_request", `email=${email}`, req);

  return generic;
}
