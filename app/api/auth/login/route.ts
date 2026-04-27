import { NextResponse } from "next/server";
import { setSession, verifyCredentials, hasTotpEnabled, getTotpSecret } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isLocked, recordFail, recordSuccess, extractIp } from "@/lib/lockout";
import { authenticator } from "otplib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { email, password, totpCode } = await req.json().catch(() => ({}));
  const ip = extractIp(req);
  if (!email || !password) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  const lock = isLocked(email, ip);
  if (lock.locked) {
    logAudit("login_locked", email, req);
    return NextResponse.json({ error: "locked", retryAfter: lock.retryAfter }, { status: 429, headers: { "Retry-After": String(lock.retryAfter) } });
  }

  const ok = await verifyCredentials(email, password);
  if (!ok) {
    recordFail(email, ip);
    logAudit("login_fail", email, req);
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  if (hasTotpEnabled()) {
    if (!totpCode) {
      return NextResponse.json({ error: "totp_required" }, { status: 401 });
    }
    const secret = getTotpSecret();
    let valid = false;
    try {
      authenticator.options = { window: 1 };
      valid = !!secret && authenticator.check(String(totpCode).replace(/\s+/g, ""), secret);
    } catch {
      valid = false;
    }
    if (!valid) {
      recordFail(email, ip);
      logAudit("login_totp_fail", email, req);
      return NextResponse.json({ error: "totp_invalid" }, { status: 401 });
    }
  }

  recordSuccess(email, ip);
  await setSession(email);
  logAudit("login", email, req);
  return NextResponse.json({ ok: true });
}
