import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const { id } = await params;
  // Make sure the chat session belongs to this user before returning messages.
  const owner = db().$client.prepare(`SELECT user_id FROM chat_session WHERE id = ?`).get(Number(id)) as { user_id: number } | undefined;
  if (!owner || owner.user_id !== userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  const messages = db().$client.prepare(`SELECT id, role, content, sources, created_at FROM chat_message WHERE session_id = ? ORDER BY created_at ASC`).all(Number(id));
  return NextResponse.json({ messages });
}
