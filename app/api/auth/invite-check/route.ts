import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { rateLimitByIp, extractIp } from "@/lib/lockout";

export const runtime = "nodejs";

/** Read the shareable invite code from data/auth.json (preferred) or env. */
function getInviteCode(): string {
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    const c = JSON.parse(fs.readFileSync(p, "utf8"));
    if (typeof c.inviteCode === "string" && c.inviteCode.trim().length > 0) return c.inviteCode.trim();
  } catch {}
  return (process.env.VITALS_INVITE_CODE || "").trim();
}

/**
 * GET /api/auth/invite-check?code=XXX
 *
 * Lightweight pre-flight check used by /signup to show "Invitation valide"
 * vs "Code invalide" before the user submits the form.
 *
 * Returns { valid: boolean } — always 200, never reveals whether a code is
 * configured at all when not provided. Doesn't add the email to the waitlist
 * (that only happens on the real POST /signup).
 */
export async function GET(req: Request) {
  // Rate limit: this endpoint is a yes/no oracle for the invite code. Without
  // this, a script can enumerate codes at thousands of requests per second.
  // Cap at 20 checks per IP per minute, blocked for 5 minutes if tripped.
  const ip = extractIp(req);
  const rl = rateLimitByIp(ip, "invite-check", 20, 60 * 1000, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { valid: false, rateLimited: true },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const url = new URL(req.url);
  const provided = (url.searchParams.get("code") || "").trim();
  if (!provided) return NextResponse.json({ valid: false });

  const configured = getInviteCode();
  // Constant-time comparison is overkill for a shared friend-invite code, but
  // we still avoid leaking the configured value: only compare, never return.
  const valid = configured.length > 0 && provided === configured;
  return NextResponse.json({ valid });
}
