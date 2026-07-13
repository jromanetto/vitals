import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { decryptProfile } from "@/lib/crypto-fields";
import { META_BY_SLUG } from "@/lib/biomarker-meta";

export type ProfileData = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  sex?: string;
  bloodType?: string;
};

export type BiomarkerRow = {
  slug: string;
  name: string;
  category: string | null;
  value: number;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  date: number;
};

export type Status = "optimal" | "normal" | "slightly-off" | "attention" | "unknown";

export type EnrichedBiomarker = BiomarkerRow & {
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
  status: Status;
};

export type DnaRow = { rsid: string; trait: string; genotype: string; magnitude: number | null; summary: string | null };
export type SupplementRow = { name: string; brand: string | null; dose: string | null; unit: string | null; timing: string | null; frequency: string | null; duration: string | null };
export type SymptomRow = { key: string; avg: number; n: number; last: string };

export type PraticienData = {
  profile: ProfileData;
  panelDate: number | null;
  offRange: EnrichedBiomarker[];
  optimal: EnrichedBiomarker[];
  bloodReport: { synthesis?: string; headline?: string; panelDate: number } | null;
  dnaRisks: DnaRow[];
  dnaProtective: DnaRow[];
  supplements: SupplementRow[];
  symptoms: SymptomRow[];
};

function statusOf(r: {
  value: number;
  refLow: number | null;
  refHigh: number | null;
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
}): Status {
  const inLong =
    r.longevityLow != null && r.longevityHigh != null && r.value >= r.longevityLow && r.value <= r.longevityHigh;
  const inLab = r.refLow != null && r.refHigh != null && r.value >= r.refLow && r.value <= r.refHigh;
  const inOpt =
    r.optimalLow != null && r.optimalHigh != null && r.value >= r.optimalLow && r.value <= r.optimalHigh;
  if (inLong) return "optimal";
  if (inLab || inOpt) return "normal";
  const ref =
    r.refLow != null && r.refHigh != null
      ? [r.refLow, r.refHigh]
      : r.optimalLow != null && r.optimalHigh != null
      ? [r.optimalLow, r.optimalHigh]
      : null;
  if (!ref) return "unknown";
  const [lo, hi] = ref;
  const offset =
    r.value < lo ? Math.abs((lo - r.value) / lo) : r.value > hi ? Math.abs((r.value - hi) / hi) : 0;
  return offset <= 0.15 ? "slightly-off" : "attention";
}

export async function loadPraticienData(userId: number): Promise<PraticienData> {
  const convex = convexServer();
  const secret = bridgeSecret();
  // userId is the already-resolved owner; read scoped to self (no view-as).
  const [profRes, bioRes, bloodRes, dnaRes, suppRes, sympRes] = await Promise.all([
    convex.query(api.profile.get, { secret, authUserId: userId }),
    convex.query(api.biomarkers.all, { secret, authUserId: userId }),
    convex.query(api.reports.bloodReports, { secret, authUserId: userId }),
    convex.query(api.dna.insights, { secret, authUserId: userId }),
    convex.query(api.supplements.list, { secret, authUserId: userId }),
    convex.query(api.symptoms.list, { secret, authUserId: userId, days: 30 }),
  ]);

  let profile: ProfileData = {};
  if (profRes.data) { try { profile = decryptProfile(JSON.parse(profRes.data)) as ProfileData; } catch { profile = {}; } }

  const bioRows = bioRes.rows as BiomarkerRow[];
  const panelDate = bioRows.length ? Math.max(...bioRows.map((b) => b.date)) : null;
  const biomarkers: BiomarkerRow[] = panelDate
    ? bioRows
        .filter((b) => b.date === panelDate)
        .map((b) => ({ slug: b.slug, name: b.name, category: b.category, value: b.value, unit: b.unit, refLow: b.refLow, refHigh: b.refHigh, date: b.date }))
        .sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()))
    : [];

  const enriched: EnrichedBiomarker[] = biomarkers.map((b) => {
    const meta = META_BY_SLUG[b.slug];
    const optimalLow = meta?.optimalLow ?? null;
    const optimalHigh = meta?.optimalHigh ?? null;
    const longevityLow = meta?.longevityLow ?? null;
    const longevityHigh = meta?.longevityHigh ?? null;
    const status = statusOf({
      value: b.value, refLow: b.refLow, refHigh: b.refHigh,
      optimalLow, optimalHigh, longevityLow, longevityHigh,
    });
    return { ...b, optimalLow, optimalHigh, longevityLow, longevityHigh, status };
  });

  const offRange = enriched.filter((b) => b.status === "slightly-off" || b.status === "attention");
  const optimal = enriched.filter((b) => b.status === "optimal" || b.status === "normal");

  let bloodReport: PraticienData["bloodReport"] = null;
  try {
    const row = (bloodRes.rows as Array<{ panelDate: number; body: string }>)[0]; // already sorted panelDate DESC
    if (row) {
      const parsed = JSON.parse(row.body);
      bloodReport = { synthesis: parsed.synthesis, headline: parsed.headline, panelDate: row.panelDate };
    }
  } catch { bloodReport = null; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dnaAll = dnaRes.rows as Array<any>;
  const toDna = (r: any): DnaRow => ({ rsid: r.rsid, trait: r.trait, genotype: r.userGenotype, magnitude: r.magnitude, summary: r.summary });
  const byMag = (a: any, b: any) => (b.magnitude ?? 0) - (a.magnitude ?? 0);
  const dnaRisks = dnaAll.filter((r) => r.hasRisk === 1).sort(byMag).slice(0, 25).map(toDna);
  const dnaProtective = dnaAll.filter((r) => r.isProtective === 1).sort(byMag).slice(0, 25).map(toDna);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supplements = (suppRes.rows as Array<any>)
    .filter((s) => s.endedAt == null)
    .map((s) => ({ name: s.name, brand: s.brand ?? null, dose: s.dose ?? null, unit: s.unit ?? null, timing: s.timing ?? null, frequency: s.frequency ?? null, duration: s.duration ?? null }) as SupplementRow)
    .sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);
  // symptoms.list is already date-windowed (days:30); aggregate by key.
  const symAgg = new Map<string, { key: string; sum: number; n: number; last: string }>();
  for (const s of sympRes.rows as Array<{ key: string; value: number; date: string }>) {
    if (s.date < sinceISO) continue;
    const a = symAgg.get(s.key);
    if (a) { a.sum += s.value; a.n += 1; if (s.date > a.last) a.last = s.date; }
    else symAgg.set(s.key, { key: s.key, sum: s.value, n: 1, last: s.date });
  }
  const symptoms = [...symAgg.values()]
    .map((a) => ({ key: a.key, avg: a.sum / a.n, n: a.n, last: a.last }) as SymptomRow)
    .sort((a, b) => b.avg - a.avg);

  return { profile, panelDate, offRange, optimal, bloodReport, dnaRisks, dnaProtective, supplements, symptoms };
}

export const SYMPTOM_LABELS: Record<string, string> = {
  energy: "Énergie", focus: "Concentration", mood: "Humeur", anxiety: "Anxiété",
  sleep_quality: "Qualité sommeil", gut: "Digestion", libido: "Libido", skin: "Peau",
  hrv: "VFC (HRV)", pain: "Douleur", stress: "Stress",
};

export const STATUS_LABELS: Record<Status, string> = {
  optimal: "Optimal", normal: "Normal",
  "slightly-off": "Légèrement hors plage", attention: "Attention", unknown: "—",
};
