#!/usr/bin/env node
/**
 * Re-derive dna_insight from stored dna_variant + the current catalog.
 * Run after a catalog edit so existing users pick up the corrections.
 *
 *   node --import tsx scripts/rederive-dna.mjs <userId>   # one user
 *   node --import tsx scripts/rederive-dna.mjs all         # every user with DNA
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db/index.ts";
import { ensureSchema } from "../lib/db/migrate.ts";
import { rederiveDnaInsights } from "../lib/dna/rederive.ts";

// dna_insight now lives in Convex — the rederive helper needs the Convex bridge
// env. Load .env.local (dev) or rely on process.env / data/auth.json (prod).
(() => {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

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
  const { insights } = await rederiveDnaInsights(uid);
  console.log(`[rederive] user ${uid}: ${insights} insights`);
}
