/**
 * Generates the structured AI blood-panel report shown on the Biomarqueurs page.
 * Extracted from the API route so it can be invoked server-side for any user
 * (e.g. a CLI regeneration after an extraction fix) without an HTTP session.
 */
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

type Row = {
  slug: string; name: string; value: number; unit: string | null;
  refLow: number | null; refHigh: number | null; date: number; source: string | null;
};

function readApiKey(): string | null {
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    return JSON.parse(readFileSync(p, "utf8")).anthropicApiKey ?? null;
  } catch { return null; }
}

function statusOf(r: { value: number; refLow: number | null; refHigh: number | null; optimalLow: number | null; optimalHigh: number | null; longevityLow: number | null; longevityHigh: number | null }): string {
  const inLong = r.longevityLow != null && r.longevityHigh != null && r.value >= r.longevityLow && r.value <= r.longevityHigh;
  const inLab = r.refLow != null && r.refHigh != null && r.value >= r.refLow && r.value <= r.refHigh;
  const inOpt = r.optimalLow != null && r.optimalHigh != null && r.value >= r.optimalLow && r.value <= r.optimalHigh;
  if (inLong) return "optimal";
  if (inLab || inOpt) return "normal";
  const ref = (r.refLow != null && r.refHigh != null) ? [r.refLow, r.refHigh] : (r.optimalLow != null && r.optimalHigh != null ? [r.optimalLow, r.optimalHigh] : null);
  if (!ref) return "unknown";
  const [lo, hi] = ref;
  const offset = r.value < lo ? Math.abs((lo - r.value) / lo) : r.value > hi ? Math.abs((r.value - hi) / hi) : 0;
  return offset <= 0.15 ? "slightly-off" : "attention";
}

const SYS = `Tu es une équipe médicale (médecin fonctionnel + biologiste + nutrithérapeute longévité).
Tu produis un compte-rendu STRUCTURÉ d'une prise de sang spécifique au format JSON STRICT.
Tu compares à la prise précédente quand disponible. Tu emploies un ton bienveillant, factuel et orienté action.
Aucun préambule, aucun markdown — uniquement le JSON.

Format de sortie EXACT:
{
  "synthesis": "1-2 phrases de synthèse globale du bilan",
  "headline": "phrase percutante (15 mots max) qui résume l'état général",
  "scoreOutOf100": 0-100,
  "highlights": [
    {"title": "Court titre", "type": "good"|"warning"|"alert", "detail": "Phrase courte (15-25 mots)"}
  ],
  "systems": [
    {
      "name": "Cardiovasculaire" | "Métabolique" | "Hépatique" | "Rénal" | "Hématologie/Fer" | "Inflammation" | "Hormones" | "Thyroïde" | "Vitamines & minéraux" | "Lipides" | "Autres",
      "status": "optimal"|"good"|"to-watch"|"alert",
      "summary": "1-2 phrases sur l'état du système",
      "keyMarkers": ["nom: valeur unité (statut court)"]
    }
  ],
  "actions": [
    {"priority": "high"|"medium"|"low", "title": "Action courte", "detail": "Une phrase max actionnable"}
  ],
  "evolution": "Si données précédentes existent: 1-2 phrases sur les principales évolutions (vs derniere prise). Sinon: chaîne vide."
}

Règles:
- 4 à 8 highlights, le mix bon/warning/alert.
- 4 à 8 systèmes regroupés (n'inclure que les systèmes avec des données présentes dans cette prise).
- 3 à 6 actions priorisées (priorité haute en premier).
- Si une valeur est dans la plage longévité, c'est OPTIMAL (mieux que normal).
- Tiens compte de l'évolution vs prise précédente.`;

/** Build (or fetch cached) the blood-panel report for a user's most recent
 * panel. Returns an { status, json } pair the API route forwards verbatim. */
export async function generateBloodReport(
  userId: number,
  opts?: { force?: boolean; date?: number },
): Promise<{ status: number; json: Record<string, unknown> }> {
  ensureSchema();
  const sqlite = db().$client;
  sqlite.exec(`CREATE TABLE IF NOT EXISTS blood_report (id INTEGER PRIMARY KEY AUTOINCREMENT, panel_date INTEGER NOT NULL UNIQUE, body TEXT NOT NULL, generated_at INTEGER NOT NULL)`);
  try { sqlite.exec(`ALTER TABLE blood_report ADD COLUMN user_id INTEGER`); } catch {}

  let targetDate: number | null = opts?.date ?? null;
  if (!targetDate) {
    const r = sqlite.prepare(`SELECT MAX(date) as d FROM biomarker WHERE user_id = ?`).get(userId) as { d: number | null };
    targetDate = r?.d ?? null;
  }
  if (!targetDate) return { status: 404, json: { error: "no panel found" } };

  if (!opts?.force) {
    const cached = sqlite.prepare(`SELECT body, generated_at FROM blood_report WHERE panel_date = ? AND user_id = ?`).get(targetDate, userId) as { body: string; generated_at: number } | undefined;
    if (cached && Date.now() - cached.generated_at < 7 * 86400 * 1000) {
      return { status: 200, json: { ...JSON.parse(cached.body), panelDate: targetDate, cached: true, generatedAt: cached.generated_at } };
    }
  }

  const rows = sqlite.prepare(`SELECT slug, name, value, unit, ref_low as refLow, ref_high as refHigh, date, source FROM biomarker WHERE date = ? AND user_id = ? ORDER BY name`).all(targetDate, userId) as Row[];
  if (rows.length === 0) return { status: 404, json: { error: "no biomarkers for this date" } };

  const prev = sqlite.prepare(`SELECT MAX(date) as d FROM biomarker WHERE date < ? AND user_id = ?`).get(targetDate, userId) as { d: number | null };
  const prevRows = prev?.d ? sqlite.prepare(`SELECT slug, value FROM biomarker WHERE date = ? AND user_id = ?`).all(prev.d, userId) as Array<{ slug: string; value: number }> : [];
  const prevBySlug = Object.fromEntries(prevRows.map((r) => [r.slug, r.value]));

  const enriched = rows.map((r) => {
    const meta = META_BY_SLUG[r.slug];
    const optimalLow = meta?.optimalLow ?? null;
    const optimalHigh = meta?.optimalHigh ?? null;
    const longevityLow = meta?.longevityLow ?? null;
    const longevityHigh = meta?.longevityHigh ?? null;
    const status = statusOf({ ...r, optimalLow, optimalHigh, longevityLow, longevityHigh });
    const prevVal = prevBySlug[r.slug];
    const deltaPct = prevVal != null && prevVal !== 0 ? ((r.value - prevVal) / Math.abs(prevVal)) * 100 : null;
    return { ...r, optimalLow, optimalHigh, longevityLow, longevityHigh, status, prevValue: prevVal ?? null, deltaPct };
  });

  const apiKey = readApiKey();
  if (!apiKey) return { status: 500, json: { error: "anthropic api key missing" } };

  const userMsg = `Prise de sang du ${new Date(targetDate).toLocaleDateString("fr-FR", { dateStyle: "long" })}:

${enriched.map((r) => {
    const refStr = r.refLow != null && r.refHigh != null ? ` (réf labo ${r.refLow}–${r.refHigh})` : "";
    const longStr = r.longevityLow != null && r.longevityHigh != null ? ` (cible longévité ${r.longevityLow}–${r.longevityHigh})` : "";
    const deltaStr = r.deltaPct != null ? ` [Δ ${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(1)}% vs précédent ${r.prevValue}]` : "";
    return `- ${r.name}: ${r.value} ${r.unit ?? ""}${refStr}${longStr}${deltaStr} → statut: ${r.status}`;
  }).join("\n")}

${prev?.d ? `Prise précédente: ${new Date(prev.d).toLocaleDateString("fr-FR", { dateStyle: "long" })}` : "Première prise enregistrée."}

Génère le compte-rendu JSON.`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 3500,
      system: SYS,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON in response");
    const report = JSON.parse(m[0]) as Record<string, unknown>;
    report.markersCount = enriched.length;
    report.outOfRangeCount = enriched.filter((r) => r.status === "slightly-off" || r.status === "attention").length;
    report.optimalCount = enriched.filter((r) => r.status === "optimal").length;

    const existingId = sqlite.prepare(`SELECT id FROM blood_report WHERE panel_date = ? AND user_id = ?`).get(targetDate, userId) as { id: number } | undefined;
    if (existingId) {
      sqlite.prepare(`UPDATE blood_report SET body = ?, generated_at = ? WHERE id = ? AND user_id = ?`).run(JSON.stringify(report), Date.now(), existingId.id, userId);
    } else {
      try {
        sqlite.prepare(`INSERT INTO blood_report (panel_date, body, generated_at, user_id) VALUES (?, ?, ?, ?)`).run(targetDate, JSON.stringify(report), Date.now(), userId);
      } catch { /* legacy row owns this panel_date; don't poison cross-tenant reads */ }
    }
    return { status: 200, json: { ...report, panelDate: targetDate, cached: false, generatedAt: Date.now(), prevPanelDate: prev?.d ?? null } };
  } catch (e) {
    return { status: 500, json: { error: (e as Error).message, panelDate: targetDate } };
  }
}
