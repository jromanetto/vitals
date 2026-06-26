/**
 * Per-user ingestion primitives, shared by the upload API route (inline, with
 * the uploader's userId) and the owner CLI (scripts/ingest.ts).
 *
 * Everything written here is stamped with user_id so a beta user's documents,
 * biomarkers, RAG chunks and DNA insights land in THEIR account, never the
 * owner's. Raw SQL throughout because the Drizzle schema doesn't model user_id.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../db";
import { parsePdf, extractDateFromPath, extractDateFromText } from "../parsers/pdf";
import { type Biomarker, parseBiomarkersFromText } from "../parsers/biomarkers";
import { extractBiomarkersLLM } from "../parsers/biomarkers-llm";
import { extractBiomarkersVision } from "../parsers/biomarkers-vision";
import { normalizeUnits } from "../parsers/normalize-units";
import { iterate23andMe } from "../parsers/dna23";
import { CATALOG, evaluate } from "../dna/catalog";
import { tokenize } from "../rag/search";
import { anthropicApiKey } from "../secrets";

/** Lab-panel markers — if the parsed text matches, extract biomarkers even when
 * the file landed in a non-blood folder (e.g. a timestamp-named scan in divers/). */
const BLOOD_TEST_MARKERS = /\b(cholest[ée]rol|hdl|ldl|trigly|h[ée]moglobin|h[ée]matocr|leucocyt|plaquett|cr[ée]atinin|gly[cé]mie|hba1c|insulin[ea]|tsh|t3 ?libre|t4 ?libre|alat|asat|gamma ?gt|ggt|ferritin|fer ?s[ée]rique|transferrin|crp|hscrp|magn[ée]sium|vitamin[ea]? ?d|vitamin[ea]? ?b12|folate|homocyst[ée]in|testost[ée]ron|oestradiol|cortisol|dhea|igf-?1|apolipoprot[ée]in|apo ?b|apo ?a|lp\(?a\)?|shbg|prolactin|\blh\b|\bfsh\b)\b/i;

function hashFile(buf: Buffer): string {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

function chunkText(text: string, size = 800, overlap = 120): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

function computeTf(text: string): Record<string, number> {
  const tokens = tokenize(text);
  if (tokens.length === 0) return {};
  const counts: Record<string, number> = {};
  for (const t of tokens) counts[t] = (counts[t] ?? 0) + 1;
  const total = tokens.length;
  const tf: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) tf[k] = v / total;
  return tf;
}

/** Top-level folder of `filePath` relative to `baseDir` (e.g. "analyses-sang"). */
export function categoryFor(filePath: string, baseDir: string): string {
  const rel = path.relative(baseDir, filePath);
  const top = rel.split(path.sep)[0];
  return top || "uncategorized";
}

export type PdfIngestResult = { added: number; biomarkers: number; skipped: boolean };

/**
 * Ingest a single PDF for one user: parse text, extract biomarkers (blood
 * panels only), index for RAG. Idempotent per (path, userId) via content hash.
 */
export async function ingestPdfFile(
  filePath: string,
  userId: number,
  category: string,
  opts?: { useLlm?: boolean; force?: boolean },
): Promise<PdfIngestResult> {
  const sqlite = db().$client;
  const buf = await fsp.readFile(filePath);
  const h = hashFile(buf);

  const existing = sqlite
    .prepare(`SELECT id, hash FROM document WHERE path = ? AND user_id = ?`)
    .get(filePath, userId) as { id: number; hash: string } | undefined;
  // `force` re-extracts even when content is unchanged (e.g. after an extractor
  // fix), going through the existing-doc update path below (old biomarkers +
  // rag chunks are cleared and rebuilt).
  if (!opts?.force && existing?.hash === h) return { added: 0, biomarkers: 0, skipped: true };

  let parsed;
  try { parsed = await parsePdf(filePath); }
  catch (e) { console.warn(`[ingest] parse failed ${filePath}:`, (e as Error).message); return { added: 0, biomarkers: 0, skipped: true }; }

  const dateMs = extractDateFromPath(filePath) ?? extractDateFromText(parsed.text);
  const title = path.basename(filePath, path.extname(filePath));
  const dateVal = dateMs ?? null;

  let docId: number;
  if (existing) {
    sqlite
      .prepare(`UPDATE document SET category = ?, title = ?, date = ?, pages = ?, text_content = ?, hash = ? WHERE id = ?`)
      .run(category, title, dateVal, parsed.numPages, parsed.text, h, existing.id);
    docId = existing.id;
    sqlite.prepare(`DELETE FROM rag_chunk WHERE doc_id = ?`).run(docId);
    sqlite.prepare(`DELETE FROM biomarker WHERE source = ? AND user_id = ?`).run(filePath, userId);
  } else {
    const r = sqlite
      .prepare(`INSERT INTO document (path, category, title, date, pages, text_content, hash, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(filePath, category, title, dateVal, parsed.numPages, parsed.text, h, userId);
    docId = Number(r.lastInsertRowid);
  }

  // Biomarkers — blood panels by folder, or by content (catches lab reports
  // with non-descriptive filenames that landed in divers/).
  let biomarkers = 0;
  const isBloodPanel = category.includes("analyses-sang") || category.includes("sha-wellness") || BLOOD_TEST_MARKERS.test(parsed.text);
  if (isBloodPanel) {
    const bmDate = dateMs ?? Date.now();
    // Prefer Claude for accuracy on OCR-scrambled lab tables (user uploads);
    // fall back to the regex parser when there's no key or the LLM returns
    // nothing (and for the owner CLI, which re-ingests clean PDFs in bulk).
    let finalBms: Biomarker[] = [];
    const apiKey = opts?.useLlm ? anthropicApiKey() : null;
    if (apiKey) {
      try { finalBms = await extractBiomarkersLLM(parsed.text, apiKey); } catch { finalBms = []; }
    }
    // Vision fallback for image-based / designed PDFs (Lucis, scans, photos):
    // pdf-parse returns sparse text, so the text LLM misses most markers.
    // Render pages → Claude vision, and merge in markers the text path lacked.
    const lowTextDensity = parsed.numPages > 0 && (parsed.text.length / parsed.numPages) < 1500;
    if (apiKey && (lowTextDensity || finalBms.length < parsed.numPages * 3)) {
      try {
        const vis = await extractBiomarkersVision(filePath, apiKey);
        const haveSlugs = new Set(finalBms.map((b) => b.slug));
        for (const v of vis) { if (!haveSlugs.has(v.slug)) { finalBms.push(v); haveSlugs.add(v.slug); } }
      } catch { /* vision best-effort */ }
    }
    if (finalBms.length === 0) {
      for (const bm of parseBiomarkersFromText(parsed.text)) {
        const norm = normalizeUnits(bm.slug, bm.value, bm.unit);
        if (!norm) continue; // rejected as garbage by sanity check
        let nLow = bm.refLow;
        let nHigh = bm.refHigh;
        if (nLow != null) { const r = normalizeUnits(bm.slug, nLow, bm.unit); if (r) nLow = r.value; }
        if (nHigh != null) { const r = normalizeUnits(bm.slug, nHigh, bm.unit); if (r) nHigh = r.value; }
        finalBms.push({ ...bm, value: norm.value, unit: norm.unit ?? null, refLow: nLow, refHigh: nHigh });
      }
    }
    const ins = sqlite.prepare(
      `INSERT INTO biomarker (name, slug, category, value, unit, ref_low, ref_high, date, source, raw_text, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const bm of finalBms) {
      ins.run(bm.name, bm.slug, bm.category, bm.value, bm.unit ?? null, bm.refLow, bm.refHigh, bmDate, filePath, bm.raw, userId);
      biomarkers++;
    }
  }

  // RAG: chunk + keyword index, all stamped with user_id.
  const chunks = chunkText(parsed.text);
  const insChunk = sqlite.prepare(`INSERT INTO rag_chunk (doc_id, chunk_idx, text, user_id) VALUES (?, ?, ?, ?)`);
  const insKw = sqlite.prepare(`INSERT INTO rag_keyword (chunk_id, term, tf, user_id) VALUES (?, ?, ?, ?)`);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const cr = insChunk.run(docId, i, c, userId);
    const chunkId = Number(cr.lastInsertRowid);
    const tf = computeTf(c);
    for (const [term, val] of Object.entries(tf)) insKw.run(chunkId, term, val, userId);
  }

  return { added: 1, biomarkers, skipped: false };
}

/**
 * Ingest a 23andMe raw genome for one user from `<baseDir>/genetique/`.
 * Scopes the wipe + inserts to user_id so it never destroys another account's DNA.
 */
export async function ingestDnaForUser(userId: number, baseDir: string): Promise<{ variants: number; insights: number }> {
  const dnaDir = path.join(baseDir, "genetique");
  let files: string[] = [];
  try { files = await fsp.readdir(dnaDir); } catch { return { variants: 0, insights: 0 }; }
  const target = files.find((f) => f.endsWith(".zip") || f.endsWith(".txt"));
  if (!target) return { variants: 0, insights: 0 };
  const fp = path.join(dnaDir, target);

  const sqlite = db().$client;
  // Scoped wipe — only THIS user's DNA, never everyone's.
  sqlite.prepare(`DELETE FROM dna_variant WHERE user_id = ?`).run(userId);
  sqlite.prepare(`DELETE FROM dna_insight WHERE user_id = ?`).run(userId);

  let total = 0;
  const wantedRsids = new Set(CATALOG.map((c) => c.rsid));
  const userGenotypes = new Map<string, string>();

  const stmt = sqlite.prepare(`INSERT OR REPLACE INTO dna_variant (rsid, chromosome, position, genotype, user_id) VALUES (?, ?, ?, ?, ?)`);
  const insertMany = sqlite.transaction((rows: { rsid: string; chromosome: string; position: number; genotype: string }[]) => {
    for (const r of rows) stmt.run(r.rsid, r.chromosome, r.position, r.genotype, userId);
  });

  let batch: { rsid: string; chromosome: string; position: number; genotype: string }[] = [];
  for await (const v of iterate23andMe(fp)) {
    batch.push(v);
    if (batch.length >= 5000) { insertMany(batch); batch = []; }
    total++;
    if (wantedRsids.has(v.rsid)) userGenotypes.set(v.rsid, v.genotype);
  }
  if (batch.length) insertMany(batch);

  let insights = 0;
  const insIns = sqlite.prepare(
    `INSERT INTO dna_insight (rsid, category, trait, effect, magnitude, risk_allele, user_genotype, has_risk, is_protective, summary, source, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const cat of CATALOG) {
    const ug = userGenotypes.get(cat.rsid);
    if (!ug) continue;
    const ev = evaluate(cat, ug);
    insIns.run(
      cat.rsid, cat.category, cat.trait, cat.effect ?? null, cat.magnitude ?? null,
      cat.riskGenotypes.join(",") || null, ug, ev.hasRisk ? 1 : 0, ev.isProtective ? 1 : 0, cat.summary, cat.source, userId,
    );
    insights++;
  }
  return { variants: total, insights };
}
