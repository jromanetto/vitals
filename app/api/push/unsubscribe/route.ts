import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = await req.json().catch(() => null) as { endpoint?: string; id?: number } | null;
  const sqlite = db().$client;
  if (body?.id) {
    sqlite
      .prepare(`DELETE FROM push_subscription WHERE id = ? AND user_id = ?`)
      .run(Number(body.id), userId);
  } else if (body?.endpoint) {
    sqlite
      .prepare(`DELETE FROM push_subscription WHERE endpoint = ? AND user_id = ?`)
      .run(body.endpoint, userId);
  } else {
    return NextResponse.json({ error: "missing_endpoint_or_id" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
