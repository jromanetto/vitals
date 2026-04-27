import { NextResponse } from "next/server";
import { getSession, writeCreds, getTotpSecret } from "@/lib/auth";
import { authenticator } from "otplib";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { code } = await req.json().catch(() => ({}));
  const secret = getTotpSecret();
  if (!secret) return NextResponse.json({ ok: true, alreadyDisabled: true });
  authenticator.options = { window: 1 };
  if (!code || !authenticator.check(String(code).replace(/\s+/g, ""), secret)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  writeCreds({ totpSecret: null });
  logAudit("totp_disabled", s.email, req);
  return NextResponse.json({ ok: true });
}
