#!/usr/bin/env node
// Verifies row counts: SQLite (source) vs Convex (loaded), per table.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const SECRET = process.env.MIGRATION_SECRET;
const db = new Database(path.join("data", "vitals.db"), { readonly: true });

const TABLES = [
  "user", "biomarker", "dna_insight", "profile", "report", "blood_report",
  "action_plan", "supplement", "supplement_log", "note", "symptom_log",
  "habit_log", "wearable_metric", "nutrition_pref", "document", "rag_chunk",
  "rag_keyword", "chat_session", "chat_message", "chat_memory", "reminder",
  "push_subscription", "card_feedback", "share_link", "weekly_checkin",
  "weekly_habit", "weekly_symptom", "ingest_log", "audit", "audit_log",
  "password_reset", "waitlist",
];

async function convexCount(table) {
  let total = 0, cursor = null, done = false;
  while (!done) {
    const r = await client.query(api.etl.countPage, { secret: SECRET, table, cursor });
    total += r.count; cursor = r.cursor; done = r.isDone;
  }
  return total;
}

const existing = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
let allOk = true;
console.log("table                    sqlite   convex   status");
for (const t of TABLES) {
  const src = existing.has(t) ? db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c : 0;
  const dst = await convexCount(t);
  const ok = src === dst;
  if (!ok) allOk = false;
  console.log(`${t.padEnd(24)} ${String(src).padStart(6)}   ${String(dst).padStart(6)}   ${ok ? "OK" : "MISMATCH"}`);
}
db.close();
console.log(allOk ? "\nALL TABLES MATCH ✓ (dna_variant deferred: stays VPS-side)" : "\nMISMATCH — investigate");
process.exit(allOk ? 0 : 1);
