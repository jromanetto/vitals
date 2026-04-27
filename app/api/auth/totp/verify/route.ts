import { NextResponse } from "next/server";
import { getSession, writeCreds } from "@/lib/auth";
import { authenticator } from "otplib";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { secret, code } = await req.json().catch(() => ({}));
  if (!secret || !code) return NextResponse.json({ error: "missing" }, { status: 400 });
  authenticator.options = { window: 1 };
  const ok = authenticator.check(String(code).replace(/\s+/g, ""), secret);
  if (!ok) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  writeCreds({ totpSecret: secret });
  logAudit("totp_enabled", s.email, req);
  return NextResponse.json({ ok: true });
}
