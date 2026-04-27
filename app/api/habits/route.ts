import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const days = Math.min(365, Number(url.searchParams.get("days") ?? "60"));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = db().$client.prepare(`SELECT date, key, value FROM habit_log WHERE date >= ? ORDER BY date DESC`).all(since);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const { date, key, value } = await req.json() as { date?: string; key: string; value: number };
  const d = date ?? new Date().toISOString().slice(0, 10);
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  db().$client.prepare(`INSERT OR REPLACE INTO habit_log (date, key, value) VALUES (?, ?, ?)`).run(d, key, value ?? 1);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const key = url.searchParams.get("key");
  if (!date || !key) return NextResponse.json({ error: "date+key required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM habit_log WHERE date = ? AND key = ?`).run(date, key);
  return NextResponse.json({ ok: true });
}
