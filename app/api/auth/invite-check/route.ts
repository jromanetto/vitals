import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

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
  const url = new URL(req.url);
  const provided = (url.searchParams.get("code") || "").trim();
  if (!provided) return NextResponse.json({ valid: false });

  const configured = getInviteCode();
  // Constant-time comparison is overkill for a shared friend-invite code, but
  // we still avoid leaking the configured value: only compare, never return.
  const valid = configured.length > 0 && provided === configured;
  return NextResponse.json({ valid });
}
