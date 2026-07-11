/**
 * Generates the structured AI blood-panel report shown on the Biomarqueurs page.
 * Extracted from the API route so it can be invoked server-side for any user
 * (e.g. a CLI regeneration after an extraction fix) without an HTTP session.
 */
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
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
  const convex = convexServer();
  const secret = bridgeSecret();
  // All measurements for the owner (owner-scoped); we derive panel dates / rows in JS.
  const all = (await convex.query(api.biomarkers.all, { secret, authUserId: userId })).rows as Row[];

  let targetDate: number | null = opts?.date ?? null;
  if (!targetDate) {
    targetDate = all.length ? Math.max(...all.map((r) => r.date)) : null;
  }
  if (!targetDate) return { status: 404, json: { error: "no panel found" } };
  const panelDate: number = targetDate;

  if (!opts?.force) {
    const cached = (await convex.query(api.reports.bloodReports, { secret, authUserId: userId })).rows.find((r) => r.panelDate === panelDate);
    if (cached && Date.now() - cached.generatedAt < 7 * 86400 * 1000) {
      return { status: 200, json: { ...JSON.parse(cached.body), panelDate: panelDate, cached: true, generatedAt: cached.generatedAt } };
    }
  }

  const rows = all.filter((r) => r.date === panelDate).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (rows.length === 0) return { status: 404, json: { error: "no biomarkers for this date" } };

  const prevDates = all.filter((r) => r.date < panelDate).map((r) => r.date);
  const prevDate: number | null = prevDates.length ? Math.max(...prevDates) : null;
  const prevRows = prevDate != null ? all.filter((r) => r.date === prevDate) : [];
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

  const userMsg = `Prise de sang du ${new Date(panelDate).toLocaleDateString("fr-FR", { dateStyle: "long" })}:

${enriched.map((r) => {
    const refStr = r.refLow != null && r.refHigh != null ? ` (réf labo ${r.refLow}–${r.refHigh})` : "";
    const longStr = r.longevityLow != null && r.longevityHigh != null ? ` (cible longévité ${r.longevityLow}–${r.longevityHigh})` : "";
    const deltaStr = r.deltaPct != null ? ` [Δ ${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(1)}% vs précédent ${r.prevValue}]` : "";
    return `- ${r.name}: ${r.value} ${r.unit ?? ""}${refStr}${longStr}${deltaStr} → statut: ${r.status}`;
  }).join("\n")}

${prevDate != null ? `Prise précédente: ${new Date(prevDate).toLocaleDateString("fr-FR", { dateStyle: "long" })}` : "Première prise enregistrée."}

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

    const generatedAt = Date.now();
    await convex.mutation(api.reports.upsertBloodReport, {
      secret, authUserId: userId, panelDate, body: JSON.stringify(report), generatedAt,
    });
    return { status: 200, json: { ...report, panelDate: panelDate, cached: false, generatedAt, prevPanelDate: prevDate ?? null } };
  } catch (e) {
    return { status: 500, json: { error: (e as Error).message, panelDate: panelDate } };
  }
}
