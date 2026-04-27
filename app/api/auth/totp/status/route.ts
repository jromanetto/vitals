import { NextResponse } from "next/server";
import { getSession, hasTotpEnabled } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: hasTotpEnabled() });
}
