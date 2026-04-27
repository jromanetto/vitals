import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";
export const maxDuration = 60;

type Row = { date: string; source: string; kind: string; value: number; unit?: string };

function parseOuraCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  if (dateIdx < 0) return [];
  const out: Row[] = [];
  // Map likely Oura column names → kind
  const kinds: Array<{ pattern: RegExp; kind: string; unit?: string }> = [
    { pattern: /average resting heart rate|rhr/i, kind: "rhr", unit: "bpm" },
    { pattern: /average hrv|hrv balance|hrv/i, kind: "hrv", unit: "ms" },
    { pattern: /total sleep duration|sleep duration|total sleep/i, kind: "sleep_total_min", unit: "min" },
    { pattern: /deep sleep duration/i, kind: "sleep_deep_min", unit: "min" },
    { pattern: /rem sleep duration/i, kind: "sleep_rem_min", unit: "min" },
    { pattern: /awake time/i, kind: "sleep_awake_min", unit: "min" },
    { pattern: /readiness score/i, kind: "readiness", unit: "score" },
    { pattern: /sleep score/i, kind: "sleep_score", unit: "score" },
    { pattern: /activity score/i, kind: "activity_score", unit: "score" },
    { pattern: /steps/i, kind: "steps", unit: "steps" },
    { pattern: /average respiratory rate/i, kind: "respiratory_rate", unit: "rpm" },
    { pattern: /average sp/i, kind: "spo2", unit: "%" },
    { pattern: /skin temperature/i, kind: "skin_temp_dev", unit: "°C" },
  ];
  const fields = headers.map((h) => kinds.find((k) => k.pattern.test(h)));

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const date = cells[dateIdx]?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (let j = 0; j < cells.length; j++) {
      const f = fields[j];
      if (!f) continue;
      const v = parseFloat(cells[j].replace(",", "."));
      if (!Number.isFinite(v)) continue;
      out.push({ date, source: "oura", kind: f.kind, value: v, unit: f.unit });
    }
  }
  return out;
}

function parseWhoopCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("cycle start"));
  if (dateIdx < 0) return [];
  const kinds: Array<{ pattern: RegExp; kind: string; unit?: string }> = [
    { pattern: /resting heart rate/i, kind: "rhr", unit: "bpm" },
    { pattern: /heart rate variability/i, kind: "hrv", unit: "ms" },
    { pattern: /recovery score/i, kind: "recovery", unit: "%" },
    { pattern: /strain/i, kind: "strain", unit: "score" },
    { pattern: /sleep performance|sleep score/i, kind: "sleep_score", unit: "%" },
    { pattern: /respiratory rate/i, kind: "respiratory_rate", unit: "rpm" },
    { pattern: /asleep duration|hours of sleep/i, kind: "sleep_total_min", unit: "min" },
    { pattern: /deep sleep|slow wave/i, kind: "sleep_deep_min", unit: "min" },
    { pattern: /rem duration|rem sleep/i, kind: "sleep_rem_min", unit: "min" },
  ];
  const fields = headers.map((h) => kinds.find((k) => k.pattern.test(h)));
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const dateRaw = cells[dateIdx];
    const date = dateRaw?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) continue;
    for (let j = 0; j < cells.length; j++) {
      const f = fields[j];
      if (!f) continue;
      const v = parseFloat(cells[j].replace(",", "."));
      if (!Number.isFinite(v)) continue;
      out.push({ date, source: "whoop", kind: f.kind, value: v, unit: f.unit });
    }
  }
  return out;
}

function parseGenericCSV(text: string, source: string): Row[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  if (dateIdx < 0) return [];
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const date = cells[dateIdx]?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (let j = 0; j < cells.length; j++) {
      if (j === dateIdx) continue;
      const v = parseFloat(cells[j].replace(",", "."));
      if (!Number.isFinite(v)) continue;
      out.push({ date, source, kind: headers[j].replace(/\s+/g, "_"), value: v });
    }
  }
  return out;
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const ct = req.headers.get("content-type") ?? "";
  let csv = "";
  let source = "generic";

  if (ct.includes("application/json")) {
    const { text, source: src } = await req.json() as { text: string; source?: string };
    csv = text; source = src ?? "generic";
  } else if (ct.includes("multipart/form-data") || ct.includes("text/")) {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    source = String(fd.get("source") ?? "generic");
    if (file) csv = await file.text();
  } else {
    csv = await req.text();
  }
  if (!csv) return NextResponse.json({ error: "no data" }, { status: 400 });

  let rows: Row[] = [];
  if (source === "oura") rows = parseOuraCSV(csv);
  else if (source === "whoop") rows = parseWhoopCSV(csv);
  else rows = parseGenericCSV(csv, source);

  if (rows.length === 0) return NextResponse.json({ error: "no rows parsed", source }, { status: 400 });

  const sqlite = db().$client;
  // Ensure table
  sqlite.exec(`CREATE TABLE IF NOT EXISTS wearable_metric (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, unit TEXT, UNIQUE(date, source, kind))`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS wearable_date_idx ON wearable_metric(date)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS wearable_kind_idx ON wearable_metric(kind)`);

  const stmt = sqlite.prepare(`INSERT OR REPLACE INTO wearable_metric (date, source, kind, value, unit) VALUES (?, ?, ?, ?, ?)`);
  const tx = sqlite.transaction((items: Row[]) => {
    for (const r of items) stmt.run(r.date, r.source, r.kind, r.value, r.unit ?? null);
  });
  tx(rows);

  return NextResponse.json({ inserted: rows.length, source, kinds: [...new Set(rows.map((r) => r.kind))] });
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS wearable_metric (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, unit TEXT, UNIQUE(date, source, kind))`);
  const url = new URL(req.url);
  const days = Math.min(365, Number(url.searchParams.get("days") ?? "60"));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = sqlite.prepare(`SELECT date, source, kind, value, unit FROM wearable_metric WHERE date >= ? ORDER BY date DESC`).all(since);
  const summary = sqlite.prepare(`SELECT source, kind, COUNT(*) c, AVG(value) avg FROM wearable_metric GROUP BY source, kind ORDER BY source, kind`).all();
  return NextResponse.json({ rows, summary });
}
