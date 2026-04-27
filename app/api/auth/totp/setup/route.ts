import { NextResponse } from "next/server";
import { getSession, readCredsFresh } from "@/lib/auth";
import { authenticator } from "otplib";
import QRCode from "qrcode";

export const runtime = "nodejs";

// Generates a fresh TOTP secret + otpauth URL + QR data URL.
// Secret is NOT yet saved — only persisted after verify.
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const c = readCredsFresh();
  const secret = authenticator.generateSecret();
  const issuer = "Vitals";
  const account = c.email || "user";
  const otpauth = authenticator.keyuri(account, issuer, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 256 });
  return NextResponse.json({ secret, otpauth, qrDataUrl });
}
