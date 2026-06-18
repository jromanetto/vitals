/**
 * Anonymizes user PII for LLM prompts. Callers pass an already user-scoped,
 * decrypted profile object; this module strips PII fields from it. Reads the
 * on/off toggle from data/auth.json.
 */
import fs from "node:fs";
import path from "node:path";

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

export function anonymizeProfile(profile: Record<string, any>): Record<string, any> {
  if (!isAnonymizeEnabled()) return profile;
  const clone: Record<string, any> = { ...profile };
  for (const k of ["firstName", "lastName", "first_name", "last_name", "name", "fullName"]) {
    if (clone[k]) clone[k] = "[USER]";
  }
  for (const k of ["email"]) if (clone[k]) clone[k] = "[EMAIL]";
  for (const k of ["phone", "phoneNumber", "tel", "emergencyContactPhone"]) if (clone[k]) clone[k] = "[PHONE]";
  for (const k of [
    "city", "address", "town", "addressLine", "postalCode", "zipCode", "zip", "country",
    "birthPlace", "preferredPharmacy",
  ]) {
    if (clone[k]) clone[k] = "[LOCATION]";
  }
  for (const k of ["emergencyContactName"]) if (clone[k]) clone[k] = "[CONTACT]";
  // currentLocation: { countryCode, city, region } — keep countryCode for context (utile au LLM
  // pour normes médicales), strip city/region.
  if (clone.currentLocation && typeof clone.currentLocation === "object") {
    const cl = clone.currentLocation as Record<string, any>;
    clone.currentLocation = { countryCode: cl.countryCode ?? null, city: "[LOCATION]", region: "[LOCATION]" };
  }
  // residenceHistory: same, only keep countryCode.
  if (Array.isArray(clone.residenceHistory)) {
    clone.residenceHistory = clone.residenceHistory.map((e: any) => ({
      countryCode: e?.countryCode ?? null,
      city: "[LOCATION]",
    }));
  }
  // pedigree.{relativeKey}.name → stripped (we keep alive/age/conditions because they are
  // clinically meaningful and not PII once names are gone).
  if (clone.pedigree && typeof clone.pedigree === "object") {
    const ped = { ...(clone.pedigree as Record<string, any>) };
    for (const [k, v] of Object.entries(ped)) {
      if (v && typeof v === "object" && "name" in (v as Record<string, any>)) {
        ped[k] = { ...(v as Record<string, any>), name: "[NAME]" };
      }
    }
    clone.pedigree = ped;
  }
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
