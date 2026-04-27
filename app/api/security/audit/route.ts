import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ events: listAudit(50) });
}
