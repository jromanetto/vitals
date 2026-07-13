#!/usr/bin/env node
// One-time: encrypt existing (plaintext) profile blobs on Convex at rest + verify
// the write-encrypts / read-decrypts round-trip. Inline crypto (mirrors
// lib/crypto-fields) so it runs on plain node. Run: node scripts/encrypt-profiles-convex.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

for (const line of (fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : [])) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const S = process.env.SERVER_BRIDGE_SECRET;
const KEY = Buffer.from(JSON.parse(fs.readFileSync("data/auth.json", "utf8")).fieldEncryptionKey, "base64");

const SENSITIVE = ["firstName", "lastName", "email", "phone", "birthDate", "birthPlace", "address", "city",
  "psychedelicsHistory", "painTreatments", "geneticPanelOther", "emergencyContactName", "emergencyContactPhone",
  "preferredPharmacy", "recreationalDrugs", "sexualActivity", "contraception", "stiTests", "fertility",
  "depressionHistory", "therapy", "primaryDoctor", "specialists", "insurance"];
const isEnc = (v) => typeof v === "string" && v.startsWith("enc:");
function encStr(s) {
  const iv = crypto.randomBytes(12), ci = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([ci.update(String(s), "utf8"), ci.final()]);
  return `enc:${iv.toString("base64")}:${ci.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}
function decStr(b) {
  const [iv, tag, ct] = b.slice(4).split(":");
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}
const encDeep = (v) => v == null || v === "" || isEnc(v) ? v : typeof v === "string" ? encStr(v)
  : Array.isArray(v) ? v.map(encDeep) : typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encDeep(x)])) : v;
function encryptProfile(o) { const out = { ...o }; for (const f of SENSITIVE) if (f in out) out[f] = encDeep(out[f]); return out; }

// --- verify round-trip on a throwaway user ---
const U = 900009;
await c.mutation(api.profile.upsert, { secret: S, authUserId: U, data: JSON.stringify(encryptProfile({ firstName: "Secret", city: "Lyon", activityLevel: "Intense (5-6x/sem)" })) });
const raw = JSON.parse((await c.query(api.profile.get, { secret: S, authUserId: U })).data);
console.log("round-trip:",
  "firstName enc?", isEnc(raw.firstName),
  "| city enc?", isEnc(raw.city),
  "| activityLevel plaintext?", raw.activityLevel === "Intense (5-6x/sem)",
  "| decrypt firstName ->", decStr(raw.firstName) === "Secret" ? "Secret ✓" : "FAIL");

// --- sweep real users (encrypt latest profile per user; idempotent) ---
const USERS = [1, 999, 1000, 1006, 1013, 1019];
let swept = 0;
for (const uid of USERS) {
  const { data } = await c.query(api.profile.get, { secret: S, authUserId: uid });
  if (!data) continue;
  await c.mutation(api.profile.upsert, { secret: S, authUserId: uid, data: JSON.stringify(encryptProfile(JSON.parse(data))) });
  const after = JSON.parse((await c.query(api.profile.get, { secret: S, authUserId: uid })).data);
  const names = ["firstName", "lastName", "email"].filter((k) => k in after);
  console.log(`user ${uid}: swept; ${names.map((k) => `${k}=enc:${isEnc(after[k])}`).join(" ")}`);
  swept++;
}
console.log(`\nswept ${swept} profiles (latest-per-user). Stale older ETL rows remain plaintext (never read; get returns latest) -> full re-ETL-with-encryption is the prod path.`);
