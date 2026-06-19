#!/usr/bin/env node
/**
 * Re-extract biomarkers from a user's already-uploaded PDFs using the LLM
 * extractor (force = ignore the unchanged-content skip). Use after an extractor
 * fix to repopulate structured biomarkers for an existing account.
 *
 *   node --import tsx scripts/reextract-pdfs.mjs <userId> [rootDir]
 *   default rootDir = data/u/<userId>
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ensureSchema } from "../lib/db/migrate.ts";
import { ingestPdfFile, categoryFor } from "../lib/ingest/index.ts";

const userId = parseInt(process.argv[2] ?? "", 10);
if (!Number.isFinite(userId)) { console.error("usage: reextract-pdfs.mjs <userId> [rootDir]"); process.exit(1); }
const root = process.argv[3] || path.join(process.cwd(), "data", "u", String(userId));

async function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

ensureSchema();
let added = 0, biomarkers = 0;
for await (const p of walk(root)) {
  if (!p.toLowerCase().endsWith(".pdf")) continue;
  const res = await ingestPdfFile(p, userId, categoryFor(p, root), { useLlm: true, force: true });
  added += res.added;
  biomarkers += res.biomarkers;
  console.log(`  ${res.biomarkers} biomarkers · ${path.basename(p)}`);
}
console.log(`[reextract] user ${userId}: ${added} docs, ${biomarkers} biomarkers total`);
