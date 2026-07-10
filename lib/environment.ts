/**
 * Location-aware environmental health context.
 *
 * From the user's city (profile.currentLocation) we derive two exposures and
 * cross-reference them with their genes + bloodwork:
 *   - Sun / UV → vitamin-D skin synthesis (months/year too low), amplified by
 *     GC / VDR / CYP2R1 variants and a measured 25-OH-D.
 *   - Air pollution (PM2.5) → oxidative load, contextualised by detox genes.
 *
 * Data is indicative: PM2.5 are approximate annual means (WHO ambient database),
 * latitude is the city centroid. Honest by design — no precision it can't back.
 */
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { decryptProfile } from "./crypto-fields";

export type EnvInsight = { title: string; detail: string; severity: "good" | "info" | "watch"; action?: string };
export type Environment = {
  location: { label: string; lat: number; pm25: number; resolved: "city" | "country" } | null;
  sun: { latitude: number; lowUvMonths: number; geneNames: string[]; vitDLevel: number | null; insight: EnvInsight } | null;
  pollution: { pm25: number; tier: string; tone: "good" | "info" | "watch"; insight: EnvInsight } | null;
};

// Curated cities → { lat, indicative annual PM2.5 µg/m³ }. French cities first
// (most users), then major world cities. Keyed lowercase, accent-insensitive.
const CITIES: Record<string, { lat: number; pm25: number }> = {
  paris: { lat: 48.85, pm25: 13 }, lyon: { lat: 45.76, pm25: 14 }, marseille: { lat: 43.30, pm25: 16 },
  lille: { lat: 50.63, pm25: 16 }, toulouse: { lat: 43.60, pm25: 12 }, nice: { lat: 43.70, pm25: 13 },
  nantes: { lat: 47.22, pm25: 11 }, bordeaux: { lat: 44.84, pm25: 11 }, strasbourg: { lat: 48.57, pm25: 15 },
  montpellier: { lat: 43.61, pm25: 12 }, rennes: { lat: 48.11, pm25: 11 }, grenoble: { lat: 45.19, pm25: 16 },
  toulon: { lat: 43.12, pm25: 13 }, "saint-etienne": { lat: 45.44, pm25: 14 }, dijon: { lat: 47.32, pm25: 13 },
  angers: { lat: 47.47, pm25: 11 }, reims: { lat: 49.26, pm25: 14 }, "le havre": { lat: 49.49, pm25: 13 },
  brest: { lat: 48.39, pm25: 9 }, clermont: { lat: 45.78, pm25: 13 }, "clermont-ferrand": { lat: 45.78, pm25: 13 },
  // Europe
  londres: { lat: 51.51, pm25: 11 }, london: { lat: 51.51, pm25: 11 }, bruxelles: { lat: 50.85, pm25: 13 },
  geneve: { lat: 46.20, pm25: 10 }, lausanne: { lat: 46.52, pm25: 10 }, madrid: { lat: 40.42, pm25: 11 },
  barcelone: { lat: 41.39, pm25: 16 }, lisbonne: { lat: 38.72, pm25: 9 }, rome: { lat: 41.90, pm25: 16 },
  milan: { lat: 45.46, pm25: 26 }, berlin: { lat: 52.52, pm25: 12 }, amsterdam: { lat: 52.37, pm25: 12 },
  // World
  "new york": { lat: 40.71, pm25: 9 }, montreal: { lat: 45.50, pm25: 9 }, "los angeles": { lat: 34.05, pm25: 13 },
  dubai: { lat: 25.20, pm25: 41 }, "le caire": { lat: 30.04, pm25: 60 }, cairo: { lat: 30.04, pm25: 60 },
  casablanca: { lat: 33.57, pm25: 28 }, dakar: { lat: 14.72, pm25: 30 }, tokyo: { lat: 35.68, pm25: 12 },
  singapour: { lat: 1.35, pm25: 18 }, delhi: { lat: 28.61, pm25: 100 }, bangkok: { lat: 13.76, pm25: 23 },
};

// countryCode → { capital latitude, national PM2.5 average } fallback.
const COUNTRIES: Record<string, { lat: number; pm25: number }> = {
  FR: { lat: 46.6, pm25: 12 }, BE: { lat: 50.5, pm25: 13 }, CH: { lat: 46.8, pm25: 10 },
  GB: { lat: 54.0, pm25: 10 }, ES: { lat: 40.0, pm25: 10 }, PT: { lat: 39.5, pm25: 8 },
  IT: { lat: 43.0, pm25: 17 }, DE: { lat: 51.0, pm25: 12 }, NL: { lat: 52.3, pm25: 12 },
  US: { lat: 39.0, pm25: 9 }, CA: { lat: 56.0, pm25: 7 }, MA: { lat: 32.0, pm25: 28 },
  SN: { lat: 14.5, pm25: 30 }, AE: { lat: 24.0, pm25: 41 }, EG: { lat: 26.0, pm25: 55 },
  JP: { lat: 36.0, pm25: 12 }, IN: { lat: 22.0, pm25: 55 }, SG: { lat: 1.35, pm25: 18 },
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Months/year where the sun is too low for the skin to make vitamin D, from
 * absolute latitude (roughly UV index < 3 around solar noon in winter). */
function lowUvMonths(lat: number): number {
  const a = Math.abs(lat);
  if (a < 30) return 0;
  if (a < 37) return 2;
  if (a < 45) return 4;
  if (a < 52) return 6;
  return 7;
}

function pm25Tier(pm25: number): { tier: string; tone: "good" | "info" | "watch" } {
  if (pm25 < 12) return { tier: "bon", tone: "good" };
  if (pm25 < 25) return { tier: "modéré", tone: "info" };
  if (pm25 < 50) return { tier: "élevé", tone: "watch" };
  return { tier: "très élevé", tone: "watch" };
}

const VITD_GENES: Record<string, string> = {
  rs2282679: "GC (transport vit. D)",
  rs7041: "GC (isoforme)",
  rs10741657: "CYP2R1 (synthèse)",
  rs2228570: "VDR (récepteur)",
};
const DETOX_GENES: Record<string, string> = {
  rs662: "PON1 (détox)",
  rs762551: "CYP1A2 (foie)",
};

// `userId` is the already-resolved (effective) user; reads go to Convex scoped
// to it. Server-side only — the bridge secret gates the call.
export async function computeEnvironment(userId: number): Promise<Environment> {
  const convex = convexServer();
  const secret = bridgeSecret();
  const [prof, dnaRes, vitDRes] = await Promise.all([
    convex.query(api.profile.get, { secret, authUserId: userId }),
    convex.query(api.dna.insights, { secret, authUserId: userId }),
    convex.query(api.biomarkers.all, { secret, authUserId: userId, slugs: ["vitamine-d-25-oh"] }),
  ]);

  // Location from the latest profile.
  let currentLocation: { city?: string; countryCode?: string; region?: string } | undefined;
  try {
    if (prof.data) {
      const p = decryptProfile(JSON.parse(prof.data)) as Record<string, unknown>;
      const cl = p.currentLocation;
      if (cl && typeof cl === "object") currentLocation = cl as typeof currentLocation;
    }
  } catch { /* no profile */ }

  if (!currentLocation || (!currentLocation.city && !currentLocation.countryCode)) {
    return { location: null, sun: null, pollution: null };
  }

  // Resolve to { lat, pm25, label }.
  let resolved: Environment["location"] = null;
  if (currentLocation.city) {
    const c = CITIES[norm(currentLocation.city)];
    if (c) resolved = { label: currentLocation.city, lat: c.lat, pm25: c.pm25, resolved: "city" };
  }
  if (!resolved && currentLocation.countryCode) {
    const co = COUNTRIES[currentLocation.countryCode.toUpperCase()];
    if (co) resolved = { label: currentLocation.region || currentLocation.countryCode, lat: co.lat, pm25: co.pm25, resolved: "country" };
  }
  if (!resolved) return { location: null, sun: null, pollution: null };

  // Genes (vit-D + detox) the user is flagged on.
  const RSIDS = new Set(["rs2282679", "rs7041", "rs10741657", "rs2228570", "rs662", "rs762551"]);
  const geneRows = (dnaRes.rows as Array<{ rsid: string; hasRisk: number | null }>).filter((g) => RSIDS.has(g.rsid));
  const vitDGeneNames = geneRows.filter((g) => g.hasRisk === 1 && VITD_GENES[g.rsid]).map((g) => VITD_GENES[g.rsid]);
  const detoxGeneNames = geneRows.filter((g) => g.hasRisk === 1 && DETOX_GENES[g.rsid]).map((g) => DETOX_GENES[g.rsid]);

  // Latest vitamin D level if measured.
  const vitDRows = vitDRes.rows as Array<{ value: number; date: number }>;
  const latestVitD = vitDRows.length ? vitDRows.reduce((a, b) => (b.date > a.date ? b : a)) : null;
  const vitDLevel: number | null = latestVitD ? latestVitD.value : null;

  // ---- Sun / vitamin D ----
  const months = lowUvMonths(resolved.lat);
  const lowVitD = vitDLevel != null && vitDLevel < 30; // ng/mL
  const sunWatch = (months >= 4 && vitDGeneNames.length > 0) || lowVitD || months >= 6;
  const sunParts: string[] = [`À cette latitude (~${Math.round(resolved.lat)}°), ta peau ne fabrique quasiment pas de vitamine D pendant ~${months} mois/an.`];
  if (vitDGeneNames.length) sunParts.push(`Tes gènes ${vitDGeneNames.join(", ")} tirent déjà ton taux vers le bas.`);
  if (vitDLevel != null) sunParts.push(`Dernier dosage : ${vitDLevel} ng/mL${lowVitD ? " (sous la cible 30)" : ""}.`);
  const sunInsight: EnvInsight = {
    title: months === 0 ? "Ensoleillement favorable" : sunWatch ? "Vitamine D à surveiller" : "Vitamine D — vigilance hivernale",
    detail: sunParts.join(" "),
    severity: months === 0 && !lowVitD ? "good" : sunWatch ? "watch" : "info",
    action: months === 0 && !lowVitD ? undefined : `Supplémenter en vitamine D3 d'octobre à mars${vitDGeneNames.length ? " (apport renforcé vu tes variants)" : ""}, et doser le 25-OH-D en fin d'hiver.`,
  };

  // ---- Pollution ----
  const { tier, tone } = pm25Tier(resolved.pm25);
  const pollParts: string[] = [`PM2.5 ~${resolved.pm25} µg/m³ (${tier})${resolved.pm25 > 5 ? `, au-dessus de la cible OMS (5)` : ""}.`];
  if (detoxGeneNames.length) pollParts.push(`Tes variants ${detoxGeneNames.join(", ")} ralentissent un peu ta détoxification.`);
  const pollInsight: EnvInsight = {
    title: tone === "good" ? "Air plutôt sain" : tone === "watch" ? "Pollution à compenser" : "Pollution modérée",
    detail: pollParts.join(" "),
    severity: tone,
    action: tone === "good" ? undefined : `Renforce les antioxydants (crucifères, baies, oméga-3, thé vert)${detoxGeneNames.length ? " — utile vu tes gènes de détox" : ""} ; ventile aux heures creuses et privilégie les espaces verts pour le sport.`,
  };

  return {
    location: resolved,
    sun: { latitude: resolved.lat, lowUvMonths: months, geneNames: vitDGeneNames, vitDLevel, insight: sunInsight },
    pollution: { pm25: resolved.pm25, tier, tone, insight: pollInsight },
  };
}
