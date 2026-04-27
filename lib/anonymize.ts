/**
 * Anonymizes user PII for LLM prompts. Reads profile fields and toggle from data/auth.json.
 */
import fs from "node:fs";
import path from "node:path";
import { db, schema } from "./db";
import { sql } from "drizzle-orm";

let _toggle: boolean | null = null;

export function isAnonymizeEnabled(): boolean {
  if (_toggle !== null) return _toggle;
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    if (!fs.existsSync(p)) return (_toggle = true);
    const c = JSON.parse(fs.readFileSync(p, "utf8"));
    _toggle = c.anonymizeLLM === undefined ? true : !!c.anonymizeLLM;
    return _toggle!;
  } catch {
    return (_toggle = true);
  }
}

export function setAnonymizeEnabled(enabled: boolean) {
  const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
  const c = JSON.parse(fs.readFileSync(p, "utf8"));
  c.anonymizeLLM = !!enabled;
  fs.writeFileSync(p, JSON.stringify(c, null, 2), "utf8");
  _toggle = !!enabled;
}

function getProfile(): Record<string, any> {
  try {
    const d = db();
    const rows = (d as any).$client.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).all() as Array<{ data: string }>;
    if (!rows[0]) return {};
    return JSON.parse(rows[0].data);
  } catch {
    return {};
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function anonymizeForLLM(text: string): string {
  if (!isAnonymizeEnabled()) return text;
  if (!text) return text;
  let out = text;
  const p = getProfile();

  // Names
  const names: string[] = [];
  for (const k of ["firstName", "lastName", "first_name", "last_name", "name", "fullName"]) {
    const v = (p as any)[k];
    if (typeof v === "string" && v.length >= 2) names.push(v);
  }
  for (const n of names) {
    out = out.replace(new RegExp(escapeRegex(n), "gi"), "[USER]");
    // Also split parts (first + last separately)
    for (const part of n.split(/\s+/)) {
      if (part.length >= 3) out = out.replace(new RegExp("\\b" + escapeRegex(part) + "\\b", "gi"), "[USER]");
    }
  }

  // Email
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");

  // Phone (international + french)
  out = out.replace(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g, (m) => {
    const digits = m.replace(/\D/g, "");
    return digits.length >= 9 && digits.length <= 15 ? "[PHONE]" : m;
  });

  // Date of birth → age
  const dob = (p as any).birthDate || (p as any).dob || (p as any).dateOfBirth;
  if (dob) {
    try {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400 * 1000));
        const iso = d.toISOString().slice(0, 10);
        out = out.replace(new RegExp(escapeRegex(iso), "g"), `[DOB age=${age}]`);
        const fr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        out = out.replace(new RegExp(escapeRegex(fr), "g"), `[DOB age=${age}]`);
      }
    } catch {}
  }

  // Location (city, address)
  const locFields: string[] = [];
  for (const k of ["city", "address", "town", "addressLine", "postalCode", "zipCode", "zip", "country"]) {
    const v = (p as any)[k];
    if (typeof v === "string" && v.length >= 2) locFields.push(v);
  }
  for (const l of locFields) {
    out = out.replace(new RegExp(escapeRegex(l), "gi"), "[LOCATION]");
  }

  return out;
}

export function anonymizeProfile(profile: Record<string, any>): Record<string, any> {
  if (!isAnonymizeEnabled()) return profile;
  const clone: Record<string, any> = { ...profile };
  for (const k of ["firstName", "lastName", "first_name", "last_name", "name", "fullName"]) {
    if (clone[k]) clone[k] = "[USER]";
  }
  for (const k of ["email"]) if (clone[k]) clone[k] = "[EMAIL]";
  for (const k of ["phone", "phoneNumber", "tel"]) if (clone[k]) clone[k] = "[PHONE]";
  for (const k of ["city", "address", "town", "addressLine", "postalCode", "zipCode", "zip", "country"]) if (clone[k]) clone[k] = "[LOCATION]";
  const dob = clone.birthDate || clone.dob || clone.dateOfBirth;
  if (dob) {
    try {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400 * 1000));
        if (clone.birthDate) clone.birthDate = `[DOB age=${age}]`;
        if (clone.dob) clone.dob = `[DOB age=${age}]`;
        if (clone.dateOfBirth) clone.dateOfBirth = `[DOB age=${age}]`;
        clone.age = age;
      }
    } catch {}
  }
  return clone;
}
