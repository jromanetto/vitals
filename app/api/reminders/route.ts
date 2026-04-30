import { NextResponse } from "next/server";
import { getSession, currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

type ReminderRow = {
  id: number;
  title: string;
  description: string | null;
  due_at: number;
  category: string | null;
  done: number;
  created_at: number;
};

function enrich(row: ReminderRow) {
  const now = Date.now();
  const diffMs = row.due_at - now;
  const daysUntil = Math.round(diffMs / 86400000);
  const overdue = !row.done && row.due_at < now;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    category: row.category,
    done: !!row.done,
    createdAt: row.created_at,
    overdue,
    daysUntil,
  };
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const rows = db().$client.prepare(
    `SELECT id, title, description, due_at, category, done, created_at FROM reminder WHERE user_id = ? ORDER BY due_at ASC`
  ).all() as ReminderRow[];
  return NextResponse.json({ rows: rows.map(enrich) });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = await req.json() as {
    title?: string;
    description?: string | null;
    dueAt?: number;
    category?: string | null;
  };
  const title = (body.title ?? "").trim();
  const dueAt = Number(body.dueAt);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!Number.isFinite(dueAt) || dueAt <= 0) return NextResponse.json({ error: "dueAt required" }, { status: 400 });
  const description = body.description?.toString().trim() || null;
  const category = body.category?.toString().trim() || null;
  const info = db().$client.prepare(
    `INSERT INTO reminder (title, description, due_at, category, user_id) VALUES (?, ?, ?, ?, ?)`
  ).run(title, description, dueAt, category);
  const row = db().$client.prepare(
    `SELECT id, title, description, due_at, category, done, created_at FROM reminder WHERE id = ?`
  ).get(Number(info.lastInsertRowid)) as ReminderRow;
  return NextResponse.json({ row: enrich(row) });
}

export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = await req.json() as { id?: number; done?: boolean };
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "id required" }, { status: 400 });
  const done = body.done ? 1 : 0;
  db().$client.prepare(`UPDATE reminder SET done = ? WHERE id = ? AND user_id = ?`).run(done, id);
  const row = db().$client.prepare(
    `SELECT id, title, description, due_at, category, done, created_at FROM reminder WHERE id = ?`
  ).get(id) as ReminderRow | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ row: enrich(row) });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM reminder WHERE id = ? AND user_id = ?`).run(id, userId);
  return NextResponse.json({ ok: true });
}
