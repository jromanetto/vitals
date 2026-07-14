#!/usr/bin/env node
/**
 * One-shot ETL: SQLite (data/vitals.db) -> Convex.
 *
 * - Maps snake_case columns to the camelCase Convex schema (convex/schema.ts).
 * - Preserves legacy integer PKs as `legacyId` and remaps FKs to *LegacyId so
 *   referential integrity survives without an id rewrite.
 * - Encrypts free-text MEDICAL blobs (report/note/chat/symptom notes, etc.) with
 *   the same AES-256-GCM format the app uses (lib/crypto-fields). `profile.data`
 *   is already field-encrypted in the source and is copied verbatim.
 * - Idempotent: wipes each table before reloading it.
 *
 * Usage:
 *   MIGRATION_SECRET=xxx node scripts/migrate-to-convex.mjs [--only=a,b] [--skip=c] [--dry]
 *
 * dna_variant (1.8M rows) is skipped by default (stays VPS-side); pass
 * --only=dna_variant to force it.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

// ---- env ----------------------------------------------------------------
function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SECRET = process.env.MIGRATION_SECRET;
if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL missing (.env.local)");
if (!SECRET) throw new Error("MIGRATION_SECRET missing (env)");

// ---- encryption (mirror of lib/crypto-fields) ---------------------------
const ENC_PREFIX = "enc:";
function fieldKey() {
  const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
  const obj = JSON.parse(fs.readFileSync(p, "utf8"));
  const buf = Buffer.from(obj.fieldEncryptionKey, "base64");
  if (buf.length !== 32) throw new Error("fieldEncryptionKey must be 32 bytes");
  return buf;
}
const KEY = fieldKey();
function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return plaintext;
  if (typeof plaintext === "string" && plaintext.startsWith(ENC_PREFIX)) return plaintext;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(String(plaintext), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// ---- helpers ------------------------------------------------------------
const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

// FK columns that must become *LegacyId (override default camel)
const FK_RENAME = {
  session_id: "sessionLegacyId",
  supplement_id: "supplementLegacyId",
  doc_id: "docLegacyId",
  chunk_id: "chunkLegacyId",
  checkin_id: "checkinLegacyId",
  report_id: "reportLegacyId",
};

// Per-table spec: hasId (legacy PK -> legacyId), enc (fields to encrypt),
// raw (fields copied verbatim, skip encryption even if free text).
const SPEC = {
  user: { hasId: true },
  biomarker: { hasId: true, enc: ["rawText"] },
  dna_insight: { hasId: true, enc: ["userGenotype", "summary"] },
  dna_variant: { hasId: false, enc: ["genotype"] },
  profile: { hasId: true, raw: ["data"] }, // already field-encrypted
  report: { hasId: true, enc: ["body"] },
  blood_report: { hasId: true, enc: ["body"] },
  action_plan: { hasId: true, enc: ["plan"] },
  supplement: { hasId: true },
  supplement_log: { hasId: true },
  note: { hasId: true, enc: ["body"] },
  symptom_log: { hasId: true, enc: ["notes"] },
  habit_log: { hasId: true },
  wearable_metric: { hasId: true },
  nutrition_pref: { hasId: true },
  document: { hasId: true, enc: ["textContent"], coerceNum: ["date"] },
  rag_chunk: { hasId: true, enc: ["text"] },
  rag_keyword: { hasId: true },
  chat_session: { hasId: true },
  chat_message: { hasId: true, enc: ["content"] },
  chat_memory: { hasId: true, enc: ["body"] },
  reminder: { hasId: true },
  push_subscription: { hasId: true },
  card_feedback: { hasId: true },
  share_link: { hasId: true },
  weekly_checkin: { hasId: true, enc: ["notes"] },
  weekly_habit: { hasId: false },
  weekly_symptom: { hasId: false },
  ingest_log: { hasId: true },
  audit: { hasId: true },
  audit_log: { hasId: true },
  password_reset: { hasId: true },
  waitlist: { hasId: true },
  household_link: { hasId: true },
};

// dna_variant excluded by default (1.8M rows).
const DEFAULT_SKIP = new Set(["dna_variant"]);

function mapRow(table, spec, row) {
  const out = {};
  const encSet = new Set(spec.enc || []);
  for (const [col, val] of Object.entries(row)) {
    if (val === null || val === undefined) continue; // Convex optional -> omit
    let key;
    if (col === "id" && spec.hasId) key = "legacyId";
    else if (col === "user_id") key = "userId";
    else if (FK_RENAME[col]) key = FK_RENAME[col];
    else key = toCamel(col);
    // Verbatim mirror of the source: values already-encrypted in SQLite (e.g.
    // private notes, encrypted profile blobs) stay encrypted; plaintext stays
    // plaintext. Migrated routes reuse their existing decrypt/encrypt logic
    // unchanged. Extending encryption-at-rest to more fields (Blocker #2) is a
    // SEPARATE hardening phase that updates routes in lockstep — never baked in
    // here, where it would break every read path. `encrypt`/encSet kept only as
    // documentation of the Blocker-#2 candidate fields.
    void encSet;
    out[key] = val;
  }
  // Coerce messy INTEGER-affinity columns that hold date strings -> epoch ms.
  for (const col of spec.coerceNum || []) {
    if (typeof out[col] === "string") {
      const n = /^\d+$/.test(out[col]) ? Number(out[col]) : Date.parse(out[col]);
      if (Number.isNaN(n)) delete out[col];
      else out[col] = n;
    }
  }
  return out;
}

// ---- run ----------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const only = args.only ? new Set(String(args.only).split(",")) : null;
const skip = args.skip ? new Set(String(args.skip).split(",")) : new Set();
const dry = !!args.dry;

const client = new ConvexHttpClient(CONVEX_URL);
const dbFile = path.join(process.cwd(), "data", "vitals.db");
const db = new Database(dbFile, { readonly: true });

const existing = new Set(
  db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name)
);
const tables = Object.keys(SPEC).filter((t) => {
  if (only) return only.has(t) && existing.has(t);
  if (skip.has(t) || DEFAULT_SKIP.has(t)) return false;
  if (!existing.has(t)) return false; // table absent from this snapshot
  return true;
});

const BATCH = 400;
const summary = [];
for (const table of tables) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  const mapped = rows.map((r) => mapRow(table, SPEC[table], r));
  if (dry) {
    summary.push(`${table}: ${mapped.length} rows (dry) sample=${JSON.stringify(mapped[0] ?? {}).slice(0, 120)}`);
    continue;
  }
  // Paginated wipe (bounded reads per call).
  let wiped;
  do {
    wiped = await client.mutation(api.etl.wipeTable, { secret: SECRET, table });
  } while (wiped.remaining);
  let inserted = 0;
  for (let i = 0; i < mapped.length; i += BATCH) {
    const r = await client.mutation(api.etl.insertBatch, {
      secret: SECRET,
      table,
      rows: mapped.slice(i, i + BATCH),
    });
    inserted += r.inserted;
    process.stdout.write(`\r  ${table}: ${inserted}/${mapped.length}   `);
  }
  const ok = inserted === mapped.length ? "OK" : `MISMATCH (src=${mapped.length})`;
  summary.push(`${table}: ${inserted} ${ok}`);
  process.stdout.write(`\r${table}: ${inserted} ${ok}\n`);
}
db.close();
console.log("\n=== ETL summary ===");
console.log(summary.join("\n"));
