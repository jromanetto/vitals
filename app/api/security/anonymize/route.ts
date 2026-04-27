import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAnonymizeEnabled, setAnonymizeEnabled } from "@/lib/anonymize";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: isAnonymizeEnabled() });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { enabled } = await req.json().catch(() => ({}));
  setAnonymizeEnabled(!!enabled);
  logAudit("anonymize_toggle", String(!!enabled), req);
  return NextResponse.json({ ok: true, enabled: !!enabled });
}
