import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const { id } = await params;
  const messages = db().$client.prepare(`SELECT id, role, content, sources, created_at FROM chat_message WHERE session_id = ? ORDER BY created_at ASC`).all(Number(id));
  return NextResponse.json({ messages });
}
