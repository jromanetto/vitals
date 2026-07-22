import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
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
async function accountExists(email: string): Promise<boolean> {
  const { id } = await convexServer().query(api.users.idByEmail, {
    secret: bridgeSecret(), email,
  });
  if (id != null) return true;
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

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email || "").trim().toLowerCase();

  // Always respond the same way so this endpoint can't be used to discover
  // which emails have accounts (anti-enumeration).
  const generic = NextResponse.json({ ok: true });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic;

  if (!(await accountExists(email))) {
    logAudit("password_reset_request_unknown", `email=${email}`, req);
    return generic;
  }

  // issue() invalidates any previous unused token for this email in the same
  // transaction as the insert, so a fresh link always revokes the older one.
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = Date.now() + TTL_MS;
  await convexServer().mutation(api.passwordReset.issue, {
    secret: bridgeSecret(), email, tokenHash, expiresAt,
  });

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await sendEmail({ to: email, ...passwordResetTemplate(resetUrl) }).catch((e) => console.error("[forgot-password] email", e));
  logAudit("password_reset_request", `email=${email}`, req);

  return generic;
}
