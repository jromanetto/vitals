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

const MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM = `Tu extrais les résultats d'analyses biologiques d'un texte de laboratoire. Le texte vient souvent d'un OCR : les colonnes (résultat / valeurs de référence / unité) peuvent être mélangées ou désordonnées. Ton rôle est de rattacher correctement chaque marqueur à SON résultat patient.

Règles:
- La "value" est le RÉSULTAT du patient, jamais une borne de référence.
- "refLow"/"refHigh" sont les bornes de l'intervalle de référence (si présentes).
- N'invente aucune valeur. Si un résultat n'est pas clairement identifiable, omets-le.
- Garde l'unité telle qu'écrite (ng/dL, mg/L, nmol/L, ...).

Réponds UNIQUEMENT avec un tableau JSON, sans prose ni markdown:
[{"name": "Testostérone totale", "value": 602, "unit": "ng/dL", "refLow": 250, "refHigh": 840}, ...]`;

type RawBm = { name?: string; value?: number; unit?: string | null; refLow?: number | null; refHigh?: number | null };

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
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: text.slice(0, 16000) }],
    });
    const content = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    parsedArray = JSON.parse(match[0]);
    if (!Array.isArray(parsedArray)) return [];
  } catch {
    return [];
  }

  const out: Biomarker[] = [];
  const seen = new Set<string>();
  for (const raw of parsedArray) {
    if (!raw || typeof raw.name !== "string" || typeof raw.value !== "number" || !Number.isFinite(raw.value)) continue;
    const alias = lookupBiomarker(raw.name);
    if (!alias) continue; // not a catalogued biomarker → drop (no hallucinated markers)
    const norm = normalizeUnits(alias.slug, raw.value, raw.unit ?? alias.unit ?? null);
    if (!norm) continue; // rejected by sanity range
    let refLow = typeof raw.refLow === "number" ? raw.refLow : null;
    let refHigh = typeof raw.refHigh === "number" ? raw.refHigh : null;
    if (refLow != null) { const r = normalizeUnits(alias.slug, refLow, raw.unit ?? null); if (r) refLow = r.value; }
    if (refHigh != null) { const r = normalizeUnits(alias.slug, refHigh, raw.unit ?? null); if (r) refHigh = r.value; }
    const key = alias.slug + ":" + norm.value;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: alias.name,
      slug: alias.slug,
      category: alias.category,
      value: norm.value,
      unit: norm.unit ?? null,
      refLow,
      refHigh,
      raw: `LLM: ${raw.name} = ${raw.value} ${raw.unit ?? ""}`.trim(),
    });
  }
  return out;
}
