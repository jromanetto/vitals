/**
 * Field-level AES-256-GCM encryption for sensitive at-rest values.
 * Encrypted blob format: enc:<iv-b64>:<tag-b64>:<ct-b64>
 *
 * The key is persisted in data/auth.json as 'fieldEncryptionKey'
 * (32 random bytes, base64). If absent, generated on first use.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const ENC_PREFIX = "enc:";

let cachedKey: Buffer | null = null;

function authPath(): string {
  return process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
}

export function getFieldKey(): Buffer {
  if (cachedKey) return cachedKey;
  const p = authPath();
  let obj: Record<string, unknown> = {};
  if (fs.existsSync(p)) {
    try {
      obj = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      obj = {};
    }
  }
  let b64 = obj.fieldEncryptionKey as string | undefined;
  if (!b64) {
    const buf = crypto.randomBytes(32);
    b64 = buf.toString("base64");
    obj.fieldEncryptionKey = b64;
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
    try { fs.chmodSync(p, 0o600); } catch {}
    cachedKey = buf;
    return cachedKey;
  }
  cachedKey = Buffer.from(b64, "base64");
  if (cachedKey.length !== 32) {
    throw new Error("fieldEncryptionKey must decode to 32 bytes");
  }
  return cachedKey;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

export function encryptField(plaintext: string, key: Buffer = getFieldKey()): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptField(blob: string, key: Buffer = getFieldKey()): string {
  if (!blob.startsWith(ENC_PREFIX)) return blob;
  const rest = blob.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, ctB64] = rest.split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("invalid enc blob");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * Sensitive fields in profile JSON that should be encrypted at rest.
 * Strings get encrypted; arrays of strings get each item encrypted; objects get
 * recursively encrypted (string leaves only).
 */
export const SENSITIVE_PROFILE_FIELDS: readonly string[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "birthDate",
  "birthPlace",
  "address",
  "city",
  // Onboarding-exhaustif: free-text narratives only. Structured fields (familyHistory,
  // activeSymptoms, screeningHistory) are kept plaintext — they contain no PII (just
  // status enums / symptom IDs / dates), and encrypting hundreds of enum cells per
  // grid would explode the JSON without adding meaningful confidentiality.
  "psychedelicsHistory",
  "painTreatments",
  "geneticPanelOther",
  "emergencyContactName",
  "emergencyContactPhone",
  "preferredPharmacy",
  "recreationalDrugs",
  "sexualActivity",
  "contraception",
  "stiTests",
  "fertility",
  "depressionHistory",
  "therapy",
  "primaryDoctor",
  "specialists",
  "insurance",
];

function encryptValueDeep(v: unknown, key: Buffer): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") {
    if (v === "" || isEncrypted(v)) return v;
    return encryptField(v, key);
  }
  if (Array.isArray(v)) return v.map((x) => encryptValueDeep(x, key));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = encryptValueDeep(val, key);
    }
    return out;
  }
  return v;
}

function decryptValueDeep(v: unknown, key: Buffer): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") {
    if (!isEncrypted(v)) return v;
    try { return decryptField(v, key); } catch { return v; }
  }
  if (Array.isArray(v)) return v.map((x) => decryptValueDeep(x, key));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = decryptValueDeep(val, key);
    }
    return out;
  }
  return v;
}

export function encryptProfile(data: Record<string, unknown>): Record<string, unknown> {
  const key = getFieldKey();
  const out: Record<string, unknown> = { ...data };
  for (const f of SENSITIVE_PROFILE_FIELDS) {
    if (f in out) out[f] = encryptValueDeep(out[f], key);
  }
  return out;
}

export function decryptProfile(data: Record<string, unknown>): Record<string, unknown> {
  const key = getFieldKey();
  const out: Record<string, unknown> = { ...data };
  for (const f of SENSITIVE_PROFILE_FIELDS) {
    if (f in out) out[f] = decryptValueDeep(out[f], key);
  }
  return out;
}
