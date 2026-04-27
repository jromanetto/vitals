import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const rows = sqlite.prepare(`SELECT id, name, dose, unit, timing, frequency, started_at as startedAt, ended_at as endedAt, notes, target_biomarker as targetBiomarker, target_snp as targetSnp, url, brand, image_url as imageUrl, created_at as createdAt FROM supplement ORDER BY (CASE WHEN ended_at IS NULL THEN 0 ELSE 1 END), name`).all();
  const today = new Date().toISOString().slice(0, 10);
  const taken = new Set((sqlite.prepare(`SELECT supplement_id FROM supplement_log WHERE date = ? AND taken = 1`).all(today) as Array<{ supplement_id: number }>).map((r) => r.supplement_id));
  return NextResponse.json({ rows, takenToday: [...taken] });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const body = await req.json();
  const sqlite = db().$client;
  if (body.id) {
    sqlite.prepare(`UPDATE supplement SET name=?, dose=?, unit=?, timing=?, frequency=?, started_at=?, ended_at=?, notes=?, target_biomarker=?, target_snp=?, url=?, brand=?, image_url=? WHERE id=?`)
      .run(body.name, body.dose ?? null, body.unit ?? null, body.timing ?? null, body.frequency ?? null, body.startedAt ?? null, body.endedAt ?? null, body.notes ?? null, body.targetBiomarker ?? null, body.targetSnp ?? null, body.url ?? null, body.brand ?? null, body.imageUrl ?? null, body.id);
    return NextResponse.json({ ok: true, id: body.id });
  }
  const r = sqlite.prepare(`INSERT INTO supplement (name, dose, unit, timing, frequency, started_at, ended_at, notes, target_biomarker, target_snp, url, brand, image_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(body.name, body.dose ?? null, body.unit ?? null, body.timing ?? null, body.frequency ?? null, body.startedAt ?? Date.now(), body.endedAt ?? null, body.notes ?? null, body.targetBiomarker ?? null, body.targetSnp ?? null, body.url ?? null, body.brand ?? null, body.imageUrl ?? null);
  return NextResponse.json({ ok: true, id: Number(r.lastInsertRowid) });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM supplement WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
