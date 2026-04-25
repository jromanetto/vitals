#!/usr/bin/env tsx
/**
 * 1. Walk data/ for PDFs → parse text, extract biomarkers, index for RAG.
 * 2. Walk data/genetique/ for 23andMe → variants + insights from catalog.
 * 3. Index knowledge-base/ markdown.
 *
 * Idempotent: hashes content and skips unchanged files.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db, schema } from "../lib/db";
import { ensureSchema } from "../lib/db/migrate";
import { parsePdf, extractDateFromPath, extractDateFromText } from "../lib/parsers/pdf";
import { parseBiomarkersFromText } from "../lib/parsers/biomarkers";
import { iterate23andMe } from "../lib/parsers/dna23";
import { CATALOG, evaluate } from "../lib/dna/catalog";
import { eq, sql } from "drizzle-orm";
import { tokenize } from "../lib/rag/search";

const DATA_DIR = path.join(process.cwd(), "data");

async function* walk(dir: string): AsyncGenerator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function hashFile(buf: Buffer): string {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

function chunk(text: string, size = 800, overlap = 120): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

function categoryFor(filePath: string): string {
  const rel = path.relative(DATA_DIR, filePath);
  const top = rel.split(path.sep)[0];
  return top || "uncategorized";
}

async function ingestPdfs() {
  let added = 0, skipped = 0, biomarkers = 0;
  const d = db();
  for await (const p of walk(DATA_DIR)) {
    if (!p.toLowerCase().endsWith(".pdf")) continue;
    const buf = await fsp.readFile(p);
    const h = hashFile(buf);
    const existing = await d.select().from(schema.document).where(eq(schema.document.path, p)).limit(1);
    if (existing[0]?.hash === h) { skipped++; continue; }

    let parsed;
    try { parsed = await parsePdf(p); }
    catch (e) { console.warn(`[pdf] failed ${p}:`, (e as Error).message); continue; }
    const dateMs = extractDateFromPath(p) ?? extractDateFromText(parsed.text);
    const cat = categoryFor(p);
    const title = path.basename(p, ".pdf");

    if (existing[0]) {
      await d.update(schema.document).set({
        category: cat, title, date: dateMs ?? null, pages: parsed.numPages, textContent: parsed.text, hash: h,
      }).where(eq(schema.document.id, existing[0].id));
      // wipe related chunks/keywords/biomarkers
      d.$client.prepare(`DELETE FROM rag_chunk WHERE doc_id = ?`).run(existing[0].id);
      d.$client.prepare(`DELETE FROM biomarker WHERE source = ?`).run(p);
    } else {
      await d.insert(schema.document).values({ path: p, category: cat, title, date: dateMs ?? null, pages: parsed.numPages, textContent: parsed.text, hash: h });
    }
    const docRow = (await d.select().from(schema.document).where(eq(schema.document.path, p)))[0];

    // Biomarkers (only blood analyses + sha-wellness for now)
    if (cat.includes("analyses-sang") || cat.includes("sha-wellness")) {
      const bms = parseBiomarkersFromText(parsed.text);
      const bmDate = dateMs ?? Date.now();
      for (const bm of bms) {
        await d.insert(schema.biomarker).values({
          name: bm.name, slug: bm.slug, category: bm.category,
          value: bm.value, unit: bm.unit ?? null,
          refLow: bm.refLow ?? null, refHigh: bm.refHigh ?? null,
          date: new Date(bmDate),
          source: p, rawText: bm.raw,
        });
        biomarkers++;
      }
    }

    // RAG: chunk + keyword index
    const chunks = chunk(parsed.text);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const ins = await d.insert(schema.ragChunk).values({ docId: docRow.id, chunkIdx: i, text: c }).returning({ id: schema.ragChunk.id });
      const id = ins[0].id;
      const tf = computeTf(c);
      for (const [term, val] of Object.entries(tf)) {
        await d.insert(schema.ragKeyword).values({ chunkId: id, term, tf: val });
      }
    }
    added++;
  }
  await d.insert(schema.ingestLog).values({ kind: "pdf", status: "ok", detail: `added=${added} skipped=${skipped} biomarkers=${biomarkers}` });
  console.log(`[pdf] added=${added} skipped=${skipped} biomarkers=${biomarkers}`);
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

async function ingestDna() {
  const dnaDir = path.join(DATA_DIR, "genetique");
  if (!fs.existsSync(dnaDir)) return;
  const files = await fsp.readdir(dnaDir);
  const target = files.find((f) => f.endsWith(".zip") || f.endsWith(".txt"));
  if (!target) return;
  const fp = path.join(dnaDir, target);

  const d = db();
  // Wipe variants + insights for clean reingest
  d.$client.prepare(`DELETE FROM dna_variant`).run();
  d.$client.prepare(`DELETE FROM dna_insight`).run();

  let total = 0;
  const wantedRsids = new Set(CATALOG.map((c) => c.rsid));
  const userGenotypes = new Map<string, string>();

  // Bulk-insert prepared
  const stmt = d.$client.prepare(`INSERT OR REPLACE INTO dna_variant (rsid, chromosome, position, genotype) VALUES (?, ?, ?, ?)`);
  const insertMany = d.$client.transaction((rows: { rsid: string; chromosome: string; position: number; genotype: string }[]) => {
    for (const r of rows) stmt.run(r.rsid, r.chromosome, r.position, r.genotype);
  });

  let batch: { rsid: string; chromosome: string; position: number; genotype: string }[] = [];
  for await (const v of iterate23andMe(fp)) {
    batch.push(v);
    if (batch.length >= 5000) { insertMany(batch); batch = []; }
    total++;
    if (wantedRsids.has(v.rsid)) userGenotypes.set(v.rsid, v.genotype);
  }
  if (batch.length) insertMany(batch);

  // Generate insights from catalog
  let insightCount = 0;
  for (const cat of CATALOG) {
    const ug = userGenotypes.get(cat.rsid);
    if (!ug) continue;
    const ev = evaluate(cat, ug);
    await d.insert(schema.dnaInsight).values({
      rsid: cat.rsid, category: cat.category, trait: cat.trait,
      effect: cat.effect ?? null, magnitude: cat.magnitude ?? null,
      riskAllele: cat.riskGenotypes.join(",") || null,
      userGenotype: ug, hasRisk: ev.hasRisk,
      summary: cat.summary, source: cat.source,
    });
    insightCount++;
  }
  await d.insert(schema.ingestLog).values({ kind: "dna", status: "ok", detail: `variants=${total} insights=${insightCount}` });
  console.log(`[dna] variants=${total} insights=${insightCount}`);
}

async function main() {
  ensureSchema();
  console.log(`Data dir: ${DATA_DIR}`);
  console.time("total");
  await ingestPdfs();
  await ingestDna();
  console.timeEnd("total");
}

main().catch((e) => { console.error(e); process.exit(1); });
