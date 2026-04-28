import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const maxDuration = 300;

const DATA_ROOT = path.join(process.cwd(), "data");

type DetectKind =
  | "whoop-cycles" | "whoop-sleep" | "whoop-workouts" | "whoop-journal"
  | "oura-trends" | "generic-csv"
  | "dna-23andme" | "pdf-document" | "image" | "markdown-note"
  | "spreadsheet" | "unknown";

type DetectResult = { kind: DetectKind; folder?: string; reason: string };

function sniff(filename: string, head: string): DetectResult {
  const f = filename.toLowerCase();
  const t = head.toLowerCase();

  // Whoop FR
  if (/score de récupération|score de recuperation/.test(t) && /variabilité de la fréquence cardiaque|variabilite de la frequence cardiaque/.test(t))
    return { kind: "whoop-cycles", reason: "Whoop · cycles physiologiques (FR)" };
  if (/performance sommeil/.test(t) && /durée du sommeil paradoxal/.test(t) && !/score de récupération/.test(t))
    return { kind: "whoop-sleep", reason: "Whoop · sommeil (FR)" };
  if (/nom de l'activité|nom de l.activite/.test(t) && /zone fc/.test(t))
    return { kind: "whoop-workouts", reason: "Whoop · entraînements (FR)" };
  if (/texte de la question/.test(t) && /a répondu oui|a repondu oui/.test(t))
    return { kind: "whoop-journal", reason: "Whoop · journal entries (FR)" };

  // Whoop EN
  if (/recovery score/.test(t) && /heart rate variability/.test(t))
    return { kind: "whoop-cycles", reason: "Whoop · physiological cycles (EN)" };
  if (/sleep performance|sleep score/.test(t) && /rem sleep/.test(t) && !/recovery/.test(t))
    return { kind: "whoop-sleep", reason: "Whoop · sleeps (EN)" };

  // Oura
  if (/readiness score/.test(t) || (/^date,/.test(head.toLowerCase()) && /average resting heart rate/.test(t)))
    return { kind: "oura-trends", reason: "Oura · trends" };

  // 23andMe genome
  if (/^# rsid\s+chromosome/i.test(head) || /^rsid\s+chromosome\s+position/i.test(head) || /23andme/.test(f))
    return { kind: "dna-23andme", reason: "23andMe · raw genome" };

  // PDFs
  if (f.endsWith(".pdf")) {
    if (/sang|biol|labo|analys|h[ée]matol|nfs|bilan/.test(f)) return { kind: "pdf-document", folder: "analyses-sang", reason: "PDF · analyse sanguine" };
    if (/consult|visit|cabinet|rapport.*m[ée]decin|cr_/.test(f)) return { kind: "pdf-document", folder: "consultations", reason: "PDF · consultation" };
    if (/dna|gene|genetic|adn/.test(f)) return { kind: "pdf-document", folder: "genetique", reason: "PDF · génétique" };
    if (/oeil|ophtalm|eye|retin|vision/.test(f)) return { kind: "pdf-document", folder: "ophtalmologie", reason: "PDF · ophtalmologie" };
    if (/imager|irm|scanner|radio|echo/.test(f)) return { kind: "pdf-document", folder: "imagerie", reason: "PDF · imagerie médicale" };
    if (/sha[\s-]?wellness|cure|retraite/.test(f)) return { kind: "pdf-document", folder: "sha-wellness-clinic", reason: "PDF · SHA Wellness" };
    return { kind: "pdf-document", folder: "divers", reason: "PDF · à classer" };
  }

  if (/\.(jpe?g|png|webp|heic|gif|bmp|tif)$/i.test(f)) return { kind: "image", folder: "divers", reason: "Image · divers" };
  if (/\.(md|txt)$/i.test(f)) return { kind: "markdown-note", reason: "Note texte/markdown" };
  if (/\.(xlsx?|ods)$/i.test(f)) return { kind: "spreadsheet", folder: "divers", reason: "Tableur (à classer)" };
  if (f.endsWith(".csv")) return { kind: "generic-csv", reason: "CSV générique" };
  return { kind: "unknown", reason: "Type inconnu" };
}

// ---- Wearable parsers ----
type Row = { date: string; source: string; kind: string; value: number; unit?: string };

const WHOOP_FR_PATTERNS: Array<{ rx: RegExp; kind: string; unit?: string }> = [
  { rx: /score de récupération|score de recuperation/i, kind: "recovery", unit: "%" },
  { rx: /fréquence cardiaque au repos|frequence cardiaque au repos/i, kind: "rhr", unit: "bpm" },
  { rx: /variabilité de la fréquence cardiaque|variabilite de la frequence cardiaque/i, kind: "hrv", unit: "ms" },
  { rx: /température cutanée|temperature cutanee/i, kind: "skin_temp", unit: "°C" },
  { rx: /niveau d'oxygène|niveau d.oxygene/i, kind: "spo2", unit: "%" },
  { rx: /effort du jour/i, kind: "strain_day", unit: "score" },
  { rx: /effort activité|effort activite/i, kind: "strain_workout", unit: "score" },
  { rx: /dépense énergétique|depense energetique/i, kind: "energy_kcal", unit: "kcal" },
  { rx: /performance sommeil/i, kind: "sleep_score", unit: "%" },
  { rx: /fréquence respiratoire|frequence respiratoire/i, kind: "respiratory_rate", unit: "rpm" },
  { rx: /durée du sommeil léger|duree du sommeil leger/i, kind: "sleep_light_min", unit: "min" },
  { rx: /durée du sommeil profond|duree du sommeil profond/i, kind: "sleep_deep_min", unit: "min" },
  { rx: /durée du sommeil paradoxal|duree du sommeil paradoxal/i, kind: "sleep_rem_min", unit: "min" },
  { rx: /^durée du sommeil( |$)|^duree du sommeil( |$)|durée du sommeil \(min\)/i, kind: "sleep_total_min", unit: "min" },
  { rx: /temps passé au lit|temps passe au lit/i, kind: "time_in_bed_min", unit: "min" },
  { rx: /temps d'éveil|temps d.eveil/i, kind: "sleep_awake_min", unit: "min" },
  { rx: /efficacité du sommeil|efficacite du sommeil/i, kind: "sleep_efficiency", unit: "%" },
  { rx: /régularité du sommeil|regularite du sommeil/i, kind: "sleep_regularity", unit: "%" },
  { rx: /dette de sommeil/i, kind: "sleep_debt_min", unit: "min" },
  { rx: /besoins en sommeil/i, kind: "sleep_need_min", unit: "min" },
  { rx: /fc max/i, kind: "hr_max", unit: "bpm" },
  { rx: /fc moyenne/i, kind: "hr_avg", unit: "bpm" },
  { rx: /durée \(min\)|duree \(min\)/i, kind: "workout_duration_min", unit: "min" },
];

// Strip BOM and invisible markers (Whoop exports include U+FEFF)
function clean(s: string): string { return s.replace(/^﻿/, "").trim(); }

function splitCsvLine(line: string): string[] {
  // Whoop uses comma but no quoted commas in numeric data; quoted values are simple. Simple parser:
  const out: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseWhoopFr(text: string, _kind: DetectKind): Row[] {
  const lines = clean(text).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => clean(h));
  const dateIdx = headers.findIndex((h) => /heure de début du cycle|cycle start time/i.test(h));
  if (dateIdx < 0) return [];
  const fields = headers.map((h) => WHOOP_FR_PATTERNS.find((p) => p.rx.test(h)));
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const date = parseDate(cells[dateIdx] ?? "");
    if (!date) continue;
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

function parseGenericCsv(text: string, source: string): Row[] {
  const lines = clean(text).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => clean(h).toLowerCase());
  const dateIdx = headers.findIndex((h) => /date|day|jour/.test(h));
  if (dateIdx < 0) return [];
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const date = parseDate(cells[dateIdx] ?? "");
    if (!date) continue;
    for (let j = 0; j < cells.length; j++) {
      if (j === dateIdx) continue;
      const v = parseFloat(cells[j].replace(",", "."));
      if (!Number.isFinite(v)) continue;
      out.push({ date, source, kind: headers[j].replace(/\s+/g, "_").slice(0, 60), value: v });
    }
  }
  return out;
}

async function saveBinary(folder: string, filename: string, buf: ArrayBuffer): Promise<string> {
  const dir = path.join(DATA_ROOT, folder);
  await mkdir(dir, { recursive: true });
  // Avoid collisions: prefix with date if file already exists conceptually
  const safeName = filename.replace(/[^\w.\-_éèàâêîôûäëïöüç ()]/g, "_");
  const target = path.join(dir, safeName);
  await writeFile(target, Buffer.from(buf));
  return target;
}

function triggerIngest() {
  // Detached background ingest. Don't await it.
  try {
    const cwd = process.cwd();
    const tsx = path.join(cwd, "node_modules", ".bin", "tsx");
    const script = path.join(cwd, "scripts", "ingest.ts");
    const proc = spawn(tsx, [script], { cwd, env: process.env, detached: true, stdio: "ignore" });
    proc.unref();
  } catch (e) {
    console.error("[upload-auto] failed to spawn ingest", e);
  }
}

function ensureWearableTable() {
  const sqlite = db().$client;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS wearable_metric (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, unit TEXT, UNIQUE(date, source, kind))`);
}

function insertWearables(rows: Row[]): number {
  if (rows.length === 0) return 0;
  ensureWearableTable();
  const sqlite = db().$client;
  const stmt = sqlite.prepare(`INSERT OR REPLACE INTO wearable_metric (date, source, kind, value, unit) VALUES (?, ?, ?, ?, ?)`);
  const tx = sqlite.transaction((items: Row[]) => { for (const r of items) stmt.run(r.date, r.source, r.kind, r.value, r.unit ?? null); });
  tx(rows);
  return rows.length;
}

type FileResult = {
  filename: string;
  size: number;
  detected: DetectKind;
  reason: string;
  status: "ok" | "skipped" | "error";
  message: string;
  inserted?: number;
  destination?: string;
};

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const fd = await req.formData();
  const files = fd.getAll("files") as File[];
  if (files.length === 0) return NextResponse.json({ error: "no files" }, { status: 400 });

  const results: FileResult[] = [];
  let needsIngest = false;

  for (const f of files) {
    const filename = f.name;
    const size = f.size;
    let detected: DetectKind = "unknown";
    let reason = "";
    let folder: string | undefined;
    try {
      const isText = /\.(csv|txt|md|tsv)$/i.test(filename);
      let head = "";
      if (isText) {
        const buf = await f.slice(0, 8000).arrayBuffer();
        head = clean(new TextDecoder("utf-8").decode(buf));
      }
      const det = sniff(filename, head);
      detected = det.kind; reason = det.reason; folder = det.folder;

      if (detected.startsWith("whoop")) {
        const text = await f.text();
        let rows: Row[] = [];
        if (detected === "whoop-cycles" || detected === "whoop-sleep" || detected === "whoop-workouts") {
          rows = parseWhoopFr(text, detected);
        } else if (detected === "whoop-journal") {
          // Skip for v1 (free-text questions, no good fit yet)
          results.push({ filename, size, detected, reason, status: "skipped", message: "Journal entries non importés (v1)" });
          continue;
        }
        const inserted = insertWearables(rows);
        results.push({ filename, size, detected, reason, status: "ok", message: `${inserted} mesures insérées`, inserted });
      } else if (detected === "oura-trends") {
        const text = await f.text();
        const rows = parseGenericCsv(text, "oura"); // headers cover most kinds
        const inserted = insertWearables(rows);
        results.push({ filename, size, detected, reason, status: "ok", message: `${inserted} mesures insérées`, inserted });
      } else if (detected === "generic-csv") {
        const text = await f.text();
        const rows = parseGenericCsv(text, "generic");
        const inserted = insertWearables(rows);
        results.push({ filename, size, detected, reason, status: "ok", message: `${inserted} mesures insérées`, inserted });
      } else if (detected === "pdf-document" || detected === "image" || detected === "spreadsheet" || detected === "dna-23andme") {
        const targetFolder = detected === "dna-23andme" ? "genetique" : (folder ?? "divers");
        const buf = await f.arrayBuffer();
        const dest = await saveBinary(targetFolder, filename, buf);
        needsIngest = true;
        results.push({ filename, size, detected, reason, status: "ok", message: `Sauvegardé dans data/${targetFolder}/ — ingestion en cours…`, destination: dest });
      } else if (detected === "markdown-note") {
        const buf = await f.arrayBuffer();
        const dest = await saveBinary("knowledge-base", filename, buf);
        needsIngest = true;
        results.push({ filename, size, detected, reason, status: "ok", message: "Sauvegardé dans la knowledge base — ingestion en cours…", destination: dest });
      } else {
        const buf = await f.arrayBuffer();
        const dest = await saveBinary("divers", filename, buf);
        results.push({ filename, size, detected, reason, status: "ok", message: "Type inconnu — sauvegardé dans divers/", destination: dest });
      }
    } catch (e) {
      results.push({ filename, size, detected, reason, status: "error", message: (e as Error).message });
    }
  }

  logAudit("upload-auto", `files=${files.length}`, req);
  if (needsIngest) triggerIngest();
  return NextResponse.json({ results, ingestionTriggered: needsIngest });
}
