import { NextResponse } from "next/server";
import { setSession, verifyCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "missing" }, { status: 400 });
  const ok = await verifyCredentials(email, password);
  if (!ok) return NextResponse.json({ error: "invalid" }, { status: 401 });
  await setSession(email);
  return NextResponse.json({ ok: true });
}
