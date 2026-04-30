import { NextResponse } from "next/server";
import { getSession, currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const rows = sqlite.prepare(`SELECT id, name, dose, unit, timing, frequency, started_at as startedAt, ended_at as endedAt, notes, target_biomarker as targetBiomarker, target_snp as targetSnp, url, brand, image_url as imageUrl, ingredients, serving_size as servingSize, suggested_use as suggestedUse, price, duration, created_at as createdAt FROM supplement WHERE user_id = ? ORDER BY (CASE WHEN ended_at IS NULL THEN 0 ELSE 1 END), name`).all();
  // Parse ingredients JSON for each row
  const parsed = (rows as Array<{ ingredients: string | null }>).map((r) => ({ ...r, ingredients: r.ingredients ? safeParse(r.ingredients) : null }));
  const today = new Date().toISOString().slice(0, 10);
  const taken = new Set((sqlite.prepare(`SELECT supplement_id FROM supplement_log WHERE date = ? AND user_id = ? AND taken = 1`).all(today, userId) as Array<{ supplement_id: number }>).map((r) => r.supplement_id));
  return NextResponse.json({ rows: parsed, takenToday: [...taken] });
}

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = await req.json();
  const sqlite = db().$client;
  const ingredientsJson = body.ingredients ? (typeof body.ingredients === "string" ? body.ingredients : JSON.stringify(body.ingredients)) : null;
  if (body.id) {
    sqlite.prepare(`UPDATE supplement SET name=?, dose=?, unit=?, timing=?, frequency=?, started_at=?, ended_at=?, notes=?, target_biomarker=?, target_snp=?, url=?, brand=?, image_url=?, ingredients=?, serving_size=?, suggested_use=?, price=?, duration=? WHERE id=? AND user_id=?`)
      .run(body.name, body.dose ?? null, body.unit ?? null, body.timing ?? null, body.frequency ?? null, body.startedAt ?? null, body.endedAt ?? null, body.notes ?? null, body.targetBiomarker ?? null, body.targetSnp ?? null, body.url ?? null, body.brand ?? null, body.imageUrl ?? null, ingredientsJson, body.servingSize ?? null, body.suggestedUse ?? null, body.price ?? null, body.duration ?? null, body.id, userId);
    return NextResponse.json({ ok: true, id: body.id });
  }
  const r = sqlite.prepare(`INSERT INTO supplement (name, dose, unit, timing, frequency, started_at, ended_at, notes, target_biomarker, target_snp, url, brand, image_url, ingredients, serving_size, suggested_use, price, duration, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(body.name, body.dose ?? null, body.unit ?? null, body.timing ?? null, body.frequency ?? null, body.startedAt ?? Date.now(), body.endedAt ?? null, body.notes ?? null, body.targetBiomarker ?? null, body.targetSnp ?? null, body.url ?? null, body.brand ?? null, body.imageUrl ?? null, ingredientsJson, body.servingSize ?? null, body.suggestedUse ?? null, body.price ?? null, body.duration ?? null);
  return NextResponse.json({ ok: true, id: Number(r.lastInsertRowid) });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM supplement WHERE id = ? AND user_id = ?`).run(id, userId);
  return NextResponse.json({ ok: true });
}
