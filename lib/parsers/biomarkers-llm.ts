/**
 * LLM-based biomarker extraction for lab PDFs whose text layer is column-
 * scrambled by OCR (e.g. a phone photo of a paper report). The regex parser in
 * biomarkers.ts associates each name with the nearest number, which on scrambled
 * text grabs a reference bound instead of the result. Claude reads the table
 * structure correctly. Output is canonicalised through the SAME alias + unit
 * pipeline as the regex path, so only catalogued biomarkers with sane units
 * survive — the LLM cannot inject unknown markers or garbage values.
 */
import Anthropic from "@anthropic-ai/sdk";
import { type Biomarker, lookupBiomarker } from "./biomarkers";
import { normalizeUnits } from "./normalize-units";
import { MODELS, THINKING } from "@/lib/ai/models.mjs";

const MODEL = MODELS.EXTRACTION;

const SYSTEM = `Tu extrais les résultats d'analyses biologiques d'un texte de laboratoire. Le texte vient souvent d'un OCR : les colonnes (résultat / valeurs de référence / unité) peuvent être mélangées ou désordonnées. Ton rôle est de rattacher correctement chaque marqueur à SON résultat patient.

Règles:
- La "value" est le RÉSULTAT du patient, jamais une borne de référence.
- "refLow"/"refHigh" sont les bornes de l'intervalle de référence (si présentes).
- N'invente aucune valeur. Si un résultat n'est pas clairement identifiable, omets-le.
- Garde l'unité telle qu'écrite (ng/dL, mg/L, nmol/L, ...).

Réponds UNIQUEMENT avec un tableau JSON, sans prose ni markdown:
[{"name": "Testostérone totale", "value": 602, "unit": "ng/dL", "refLow": 250, "refHigh": 840}, ...]`;

export type RawBm = { name?: string; value?: number; unit?: string | null; refLow?: number | null; refHigh?: number | null };

export const BIOMARKER_EXTRACTION_SYSTEM = SYSTEM;

/** Recover individual biomarker objects when the JSON array is malformed or
 * truncated (e.g. the model hit max_tokens mid-array). Each top-level {...} is
 * parsed independently; unparseable fragments are skipped. */
export function salvageObjects(s: string): RawBm[] {
  const out: RawBm[] = [];
  for (const m of s.matchAll(/\{[^{}]*\}/g)) {
    try { out.push(JSON.parse(m[0])); } catch { /* skip fragment */ }
  }
  return out;
}

/** Canonicalise raw {name,value,unit,refLow,refHigh} objects (from text or
 * vision extraction) through the SAME alias + unit-sanity pipeline as the regex
 * path. Drops anything not in the catalog or failing the sanity range — so the
 * model can't inject unknown markers or garbage. Dedups by slug:value. */
export function canonicalizeRawBiomarkers(parsedArray: RawBm[], tag = "LLM"): Biomarker[] {
  const out: Biomarker[] = [];
  const seen = new Set<string>();
  for (const raw of parsedArray) {
    if (!raw || typeof raw.name !== "string" || typeof raw.value !== "number" || !Number.isFinite(raw.value)) continue;
    const alias = lookupBiomarker(raw.name);
    if (!alias) continue;
    const norm = normalizeUnits(alias.slug, raw.value, raw.unit ?? alias.unit ?? null);
    if (!norm) continue;
    let refLow = typeof raw.refLow === "number" ? raw.refLow : null;
    let refHigh = typeof raw.refHigh === "number" ? raw.refHigh : null;
    if (refLow != null) { const r = normalizeUnits(alias.slug, refLow, raw.unit ?? null); if (r) refLow = r.value; }
    if (refHigh != null) { const r = normalizeUnits(alias.slug, refHigh, raw.unit ?? null); if (r) refHigh = r.value; }
    const key = alias.slug + ":" + norm.value;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: alias.name, slug: alias.slug, category: alias.category,
      value: norm.value, unit: norm.unit ?? null, refLow, refHigh,
      raw: `${tag}: ${raw.name} = ${raw.value} ${raw.unit ?? ""}`.trim(),
    });
  }
  return out;
}

/**
 * Extract biomarkers from lab text via Claude. Returns [] on any failure so the
 * caller can fall back to the regex parser. Never throws.
 */
export async function extractBiomarkersLLM(text: string, apiKey: string): Promise<Biomarker[]> {
  if (!text || text.trim().length < 40) return [];
  let parsedArray: RawBm[];
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      // A full lab panel (NFS + lipids + metabolic + renal + liver + vitamins)
      // is 30-40 markers with ref ranges — easily >2k output tokens. Too small
      // a cap truncated the JSON mid-array, the parse failed, and the caller
      // fell back to the regex parser on OCR-scrambled text (garbage values).
      thinking: THINKING.EXTRACTION,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: text.slice(0, 24000) }],
    });
    const content = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const match = content.match(/\[[\s\S]*\]/);
    try {
      parsedArray = JSON.parse(match ? match[0] : content);
      if (!Array.isArray(parsedArray)) parsedArray = salvageObjects(content);
    } catch {
      // Truncated / malformed array → salvage whatever complete objects exist.
      parsedArray = salvageObjects(content);
    }
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) return [];
  } catch {
    return [];
  }

  return canonicalizeRawBiomarkers(parsedArray, "LLM");
}
