import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Edit or delete a single biomarker measurement — lets users fix a wrong
 * extracted value or remove garbage. Strictly user_id-scoped. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  ensureSchema();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { value?: number; unit?: string | null; refLow?: number | null; refHigh?: number | null; date?: string };
  const sqlite = db().$client;
  const owned = sqlite.prepare(`SELECT id FROM biomarker WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.value === "number" && Number.isFinite(body.value)) { sets.push("value = ?"); vals.push(body.value); }
  if (body.unit === null || typeof body.unit === "string") { sets.push("unit = ?"); vals.push(body.unit); }
  if (body.refLow === null || typeof body.refLow === "number") { sets.push("ref_low = ?"); vals.push(body.refLow); }
  if (body.refHigh === null || typeof body.refHigh === "number") { sets.push("ref_high = ?"); vals.push(body.refHigh); }
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    const ms = Date.parse(body.date + "T00:00:00.000Z");
    if (Number.isFinite(ms)) { sets.push("date = ?"); vals.push(ms); }
  }
  if (sets.length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  sqlite.prepare(`UPDATE biomarker SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...vals, id, userId);
  logAudit("biomarker-edit", `id=${id} user=${userId}`, req);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  ensureSchema();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const sqlite = db().$client;
  const r = sqlite.prepare(`DELETE FROM biomarker WHERE id = ? AND user_id = ?`).run(id, userId);
  if (r.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  logAudit("biomarker-delete", `id=${id} user=${userId}`, req);
  return NextResponse.json({ ok: true });
}
