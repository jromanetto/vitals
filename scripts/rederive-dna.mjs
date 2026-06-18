#!/usr/bin/env node
/**
 * Re-derive dna_insight from stored dna_variant + the current catalog.
 * Run after a catalog edit so existing users pick up the corrections.
 *
 *   node --import tsx scripts/rederive-dna.mjs <userId>   # one user
 *   node --import tsx scripts/rederive-dna.mjs all         # every user with DNA
 */
import { db } from "../lib/db/index.ts";
import { ensureSchema } from "../lib/db/migrate.ts";
import { rederiveDnaInsights } from "../lib/dna/rederive.ts";

ensureSchema();
const arg = process.argv[2];
if (!arg) {
  console.error("usage: rederive-dna.mjs <userId|all>");
  process.exit(1);
}

const sqlite = db().$client;
const userIds = arg === "all"
  ? (sqlite.prepare(`SELECT DISTINCT user_id FROM dna_variant`).all()).map((r) => r.user_id)
  : [parseInt(arg, 10)];

for (const uid of userIds) {
  const { insights } = rederiveDnaInsights(uid);
  console.log(`[rederive] user ${uid}: ${insights} insights`);
}
