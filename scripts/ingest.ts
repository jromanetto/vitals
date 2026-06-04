#!/usr/bin/env tsx
/**
 * Walk a data root for PDFs + a 23andMe genome and ingest them for one user.
 *
 * Usage:
 *   tsx scripts/ingest.ts [userId] [rootDir]
 *   - userId  : owner of the ingested data (default 1, the legacy single-tenant owner)
 *   - rootDir : directory to scan (default ./data)
 *
 * Per-file ingestion logic lives in lib/ingest so the upload API route can
 * reuse it inline with the uploader's userId. Idempotent: hashes content and
 * skips unchanged files.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { db, schema } from "../lib/db";
import { ensureSchema } from "../lib/db/migrate";
import { ingestPdfFile, ingestDnaForUser, categoryFor } from "../lib/ingest";

const DATA_DIR = path.join(process.cwd(), "data");

const USER_ID = parseInt(process.argv[2] ?? "1", 10) || 1;
const ROOT_DIR = process.argv[3] || DATA_DIR;

async function* walk(dir: string): AsyncGenerator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function ingestPdfs() {
  let added = 0, skipped = 0, biomarkers = 0;
  for await (const p of walk(ROOT_DIR)) {
    if (!p.toLowerCase().endsWith(".pdf")) continue;
    const res = await ingestPdfFile(p, USER_ID, categoryFor(p, ROOT_DIR));
    if (res.skipped) skipped++; else added++;
    biomarkers += res.biomarkers;
  }
  await db().insert(schema.ingestLog).values({ kind: "pdf", status: "ok", detail: `added=${added} skipped=${skipped} biomarkers=${biomarkers} user=${USER_ID}` });
  console.log(`[pdf] added=${added} skipped=${skipped} biomarkers=${biomarkers} user=${USER_ID}`);
}

async function ingestDna() {
  const res = await ingestDnaForUser(USER_ID, ROOT_DIR);
  if (res.variants === 0 && res.insights === 0) return;
  await db().insert(schema.ingestLog).values({ kind: "dna", status: "ok", detail: `variants=${res.variants} insights=${res.insights} user=${USER_ID}` });
  console.log(`[dna] variants=${res.variants} insights=${res.insights} user=${USER_ID}`);
}

async function main() {
  ensureSchema();
  console.log(`Data dir: ${ROOT_DIR} · user: ${USER_ID}`);
  console.time("total");
  await ingestPdfs();
  await ingestDna();
  console.timeEnd("total");
}

main().catch((e) => { console.error(e); process.exit(1); });
