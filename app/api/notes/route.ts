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
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  const tag = url.searchParams.get("tag");
  const sqlite = db().$client;
  let rows: unknown[];
  if (targetType && targetId) {
    rows = sqlite.prepare(`SELECT id, target_type as targetType, target_id as targetId, body, tags, created_at as createdAt, updated_at as updatedAt FROM note WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC`).all(targetType, targetId);
  } else if (tag) {
    rows = sqlite.prepare(`SELECT id, target_type as targetType, target_id as targetId, body, tags, created_at as createdAt, updated_at as updatedAt FROM note WHERE tags LIKE ? ORDER BY created_at DESC`).all(`%${tag}%`);
  } else {
    rows = sqlite.prepare(`SELECT id, target_type as targetType, target_id as targetId, body, tags, created_at as createdAt, updated_at as updatedAt FROM note ORDER BY created_at DESC LIMIT 200`).all();
  }
  // Aggregate distinct tags
  const tagsRaw = sqlite.prepare(`SELECT tags FROM note WHERE tags IS NOT NULL AND tags != ''`).all() as Array<{ tags: string }>;
  const tagSet = new Set<string>();
  for (const r of tagsRaw) for (const t of (r.tags ?? "").split(",")) {
    const tt = t.trim();
    if (tt) tagSet.add(tt);
  }
  return NextResponse.json({ rows, tags: [...tagSet].sort() });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = await req.json() as { id?: number; targetType: string; targetId: string; body: string; tags?: string };
  if (!body.targetType || !body.targetId || !body.body) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const sqlite = db().$client;
  const tags = (body.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).join(",");
  const now = Date.now();
  if (body.id) {
    sqlite.prepare(`UPDATE note SET body = ?, tags = ?, updated_at = ? WHERE id = ?`).run(body.body, tags, now, body.id);
    return NextResponse.json({ ok: true, id: body.id });
  }
  const r = sqlite.prepare(`INSERT INTO note (target_type, target_id, body, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(body.targetType, body.targetId, body.body, tags, now, now);
  return NextResponse.json({ ok: true, id: Number(r.lastInsertRowid) });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM note WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
