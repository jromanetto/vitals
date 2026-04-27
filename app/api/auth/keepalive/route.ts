import { NextResponse } from "next/server";
import { getSession, refreshActive } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await refreshActive();
  return NextResponse.json({ ok: true });
}
