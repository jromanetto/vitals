import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const { supplementId, date, taken } = await req.json() as { supplementId: number; date?: string; taken: boolean };
  const d = date ?? new Date().toISOString().slice(0, 10);
  const sqlite = db().$client;
  if (taken) {
    sqlite.prepare(`INSERT OR REPLACE INTO supplement_log (supplement_id, date, taken) VALUES (?, ?, 1)`).run(supplementId, d);
  } else {
    sqlite.prepare(`DELETE FROM supplement_log WHERE supplement_id = ? AND date = ?`).run(supplementId, d);
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const supplementId = Number(url.searchParams.get("supplementId"));
  const days = Math.min(365, Number(url.searchParams.get("days") ?? "90"));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const sqlite = db().$client;
  if (supplementId) {
    const rows = sqlite.prepare(`SELECT date, taken FROM supplement_log WHERE supplement_id = ? AND date >= ? ORDER BY date DESC`).all(supplementId, since);
    return NextResponse.json({ rows });
  }
  const rows = sqlite.prepare(`SELECT supplement_id as supplementId, date FROM supplement_log WHERE taken = 1 AND date >= ?`).all(since);
  return NextResponse.json({ rows });
}
