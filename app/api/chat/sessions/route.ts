import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sessions = db().$client
    .prepare(`SELECT id, title, created_at, updated_at FROM chat_session WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(userId);
  return NextResponse.json({ sessions });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Verify the session belongs to the current user before deleting.
  const owner = db().$client.prepare(`SELECT user_id FROM chat_session WHERE id = ?`).get(id) as { user_id: number } | undefined;
  if (!owner || owner.user_id !== userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  db().$client.prepare(`DELETE FROM chat_message WHERE session_id = ?`).run(id);
  db().$client.prepare(`DELETE FROM chat_session WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
