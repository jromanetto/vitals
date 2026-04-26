import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sessions = db().$client.prepare(`SELECT id, title, created_at, updated_at FROM chat_session ORDER BY updated_at DESC`).all();
  return NextResponse.json({ sessions });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM chat_message WHERE session_id = ?`).run(id);
  db().$client.prepare(`DELETE FROM chat_session WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
