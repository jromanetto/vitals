import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["fact", "preference", "goal", "concern", "medical_history"]);

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const rows = db()
    .$client.prepare(
      `SELECT id, kind, body, source_session_id, confidence, created_at, active FROM chat_memory WHERE user_id = ? ORDER BY active DESC, kind, created_at DESC`
    )
    .all(s.userId);
  return NextResponse.json({ memories: rows });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = (await req.json()) as { id?: number; kind?: string; body?: string; confidence?: number; active?: number };
  const sqlite = db().$client;
  if (body.id) {
    // Update existing memory
    const cols: string[] = [];
    const vals: unknown[] = [];
    if (body.kind && ALLOWED_KINDS.has(body.kind)) {
      cols.push("kind = ?");
      vals.push(body.kind);
    }
    if (typeof body.body === "string") {
      cols.push("body = ?");
      vals.push(body.body.slice(0, 500));
    }
    if (typeof body.confidence === "number") {
      cols.push("confidence = ?");
      vals.push(Math.min(Math.max(body.confidence, 0), 1));
    }
    if (typeof body.active === "number") {
      cols.push("active = ?");
      vals.push(body.active ? 1 : 0);
    }
    if (!cols.length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    vals.push(body.id, s.userId);
    sqlite.prepare(`UPDATE chat_memory SET ${cols.join(", ")} WHERE id = ? AND user_id = ?`).run(...vals);
    return NextResponse.json({ ok: true });
  }
  // Create new memory
  if (!body.kind || !ALLOWED_KINDS.has(body.kind)) return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  if (!body.body || typeof body.body !== "string") return NextResponse.json({ error: "body required" }, { status: 400 });
  const ins = sqlite
    .prepare(
      `INSERT INTO chat_memory (kind, body, confidence, created_at, active, user_id) VALUES (?, ?, ?, ?, 1, ?)`
    )
    .run(body.kind, body.body.slice(0, 500), body.confidence ?? 0.9, Date.now(), s.userId);
  return NextResponse.json({ ok: true, id: Number(ins.lastInsertRowid) });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM chat_memory WHERE id = ? AND user_id = ?`).run(id, s.userId);
  return NextResponse.json({ ok: true });
}
