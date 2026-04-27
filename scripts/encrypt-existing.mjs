#!/usr/bin/env node
/**
 * One-shot migration: encrypt sensitive fields in the latest profile row.
 * Idempotent: skips values already prefixed with 'enc:'.
 *
 * Usage: node scripts/encrypt-existing.mjs
 */
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DB_PATH = process.env.VITALS_DB_PATH || path.join(ROOT, "data", "vitals.db");
const AUTH_PATH = process.env.VITALS_CREDS_PATH || path.join(ROOT, "data", "auth.json");
const ENC_PREFIX = "enc:";

function getKey() {
  let obj = {};
  if (fs.existsSync(AUTH_PATH)) obj = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  let b64 = obj.fieldEncryptionKey;
  if (!b64) {
    const buf = crypto.randomBytes(32);
    b64 = buf.toString("base64");
    obj.fieldEncryptionKey = b64;
    fs.writeFileSync(AUTH_PATH, JSON.stringify(obj, null, 2), "utf8");
    try { fs.chmodSync(AUTH_PATH, 0o600); } catch {}
    console.log("[migrate] generated new fieldEncryptionKey");
    return buf;
  }
  return Buffer.from(b64, "base64");
}

const KEY = getKey();

function encryptField(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

function isEncrypted(v) {
  return typeof v === "string" && v.startsWith(ENC_PREFIX);
}

const SENSITIVE = [
  "firstName", "lastName", "email", "phone", "birthDate", "birthPlace",
  "address", "city", "recreationalDrugs", "sexualActivity", "contraception",
  "stiTests", "fertility", "depressionHistory", "therapy",
  "primaryDoctor", "specialists", "insurance",
];

let counter = { encrypted: 0, skipped: 0 };

function encDeep(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") {
    if (v === "" || isEncrypted(v)) { counter.skipped++; return v; }
    counter.encrypted++;
    return encryptField(v);
  }
  if (Array.isArray(v)) return v.map(encDeep);
  if (typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = encDeep(val);
    return out;
  }
  return v;
}

const db = new Database(DB_PATH);
const rows = db.prepare(`SELECT id, data FROM profile ORDER BY updated_at DESC`).all();
console.log(`[migrate] found ${rows.length} profile row(s)`);
let migrated = 0;
for (const row of rows) {
  let parsed;
  try { parsed = JSON.parse(row.data); } catch { console.warn(`[migrate] skip row ${row.id}: invalid JSON`); continue; }
  const before = JSON.stringify(parsed);
  const out = { ...parsed };
  for (const f of SENSITIVE) {
    if (f in out) out[f] = encDeep(out[f]);
  }
  const after = JSON.stringify(out);
  if (before !== after) {
    db.prepare(`UPDATE profile SET data = ? WHERE id = ?`).run(after, row.id);
    migrated++;
  }
}
console.log(`[migrate] updated ${migrated} row(s); fields encrypted: ${counter.encrypted}, skipped (already enc or empty): ${counter.skipped}`);
db.close();
