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
  const row = db().$client.prepare(`SELECT id, body, title, meta, kind FROM report WHERE id = ? AND user_id = ?`).get(Number(id), userId) as { id: number; body: string; title: string; meta: string | null; kind: string } | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  let meta: Record<string, unknown> = {};
  try { meta = row.meta ? (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta) : {}; } catch {}
  return NextResponse.json({ id: row.id, body: row.body, title: row.title, kind: row.kind, meta });
}
