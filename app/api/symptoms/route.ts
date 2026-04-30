import { NextResponse } from "next/server";
import { getSession, currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const days = Math.min(365, Number(url.searchParams.get("days") ?? "90"));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const sqlite = db().$client;
  const rows = sqlite.prepare(`SELECT id, date, key, value, notes, created_at as createdAt FROM symptom_log WHERE user_id = ? AND date >= ? ORDER BY date DESC, key`).all(since);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = await req.json() as { date?: string; key: string; value: number; notes?: string };
  const d = body.date ?? new Date().toISOString().slice(0, 10);
  if (!body.key || typeof body.value !== "number") return NextResponse.json({ error: "key+value required" }, { status: 400 });
  const sqlite = db().$client;
  sqlite.prepare(`INSERT OR REPLACE INTO symptom_log (date, key, value, notes) VALUES (?, ?, ?, ?)`).run(d, body.key, body.value, body.notes ?? null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM symptom_log WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
