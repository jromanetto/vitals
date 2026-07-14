import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { anthropicApiKey } from "@/lib/secrets";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import { decryptProfile } from "@/lib/crypto-fields";
import { runEngine, inputFingerprint } from "@/lib/nutrition/rules-engine";
import { generatePlan, fallbackPlan } from "@/lib/nutrition/prompt";
import type { NutritionPlan, NutritionPref } from "@/lib/nutrition/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
const REPORT_KIND = "nutrition-plan";

// Convex nutrition_pref stores allergies/cuisines as JSON strings (like the legacy
// SQLite columns), so they still need parsing here.
type NutritionPrefRow = { dietType: string; allergies: string; aversions: string; budget: string; cuisines: string };
function prefsFromRow(row: NutritionPrefRow | null): NutritionPref {
  if (!row) {
    return { dietType: "omnivore", allergies: [], aversions: "", budget: "medium", cuisines: [] };
  }
  return {
    dietType: row.dietType as NutritionPref["dietType"],
    allergies: safeJsonArray(row.allergies),
    aversions: row.aversions ?? "",
    budget: row.budget as NutritionPref["budget"],
    cuisines: safeJsonArray(row.cuisines),
  };
}

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

function summarizeProfile(p: Record<string, unknown>): string {
  const age = p.birthDate ? new Date().getFullYear() - new Date(p.birthDate as string).getFullYear() : null;
  return [
    age != null ? `âge ${age}` : null,
    p.sex ? `sexe ${p.sex}` : null,
    p.activityLevel ? `activité ${p.activityLevel}` : null,
    p.dietType ? `régime habituel ${p.dietType}` : null,
    p.weight ? `poids ${p.weight} kg` : null,
    p.height ? `taille ${p.height} cm` : null,
    Array.isArray(p.goals) && p.goals.length ? `objectifs ${(p.goals as string[]).join(", ")}` : null,
  ].filter(Boolean).join(", ") || "non renseigné";
}

export async function GET(req: Request) {
  const userId = await effectiveUserId();
  const authId = await currentUserId();
  if (!userId || !authId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const viewingOther = userId !== authId; // viewing a household member → never persist
  const readViewUserId = userId; // effectiveUserId (truthy here)

  const url = new URL(req.url);
  // ?refresh=1 (preferred) or legacy ?force=1 forces regeneration
  const force = url.searchParams.get("refresh") === "1" || url.searchParams.get("force") === "1";

  // Fast path: serve any recent cached plan immediately, scoped to this user
  // (Convex resolves the read user) so demo accounts never see Julien's plan.
  if (!force) {
    const { row } = await convexServer().query(api.reports.latestByKind, {
      secret: bridgeSecret(), authUserId: authId, viewUserId: readViewUserId, kind: REPORT_KIND,
    });
    if (row && Date.now() - row.createdAt < CACHE_TTL_MS) {
      try {
        const plan = JSON.parse(row.body) as NutritionPlan;
        return NextResponse.json({ ...plan, cached: true, generatedAt: row.createdAt });
      } catch {}
    }
  }

  // Reads via Convex (isolation resolved server-side via read-user resolution).
  const [prefRes, bioRes, dnaRes, profRes] = await Promise.all([
    convexServer().query(api.profile.nutritionPref, { secret: bridgeSecret(), authUserId: authId, viewUserId: readViewUserId }),
    convexServer().query(api.biomarkers.all, { secret: bridgeSecret(), authUserId: authId, viewUserId: readViewUserId }),
    convexServer().query(api.dna.insights, { secret: bridgeSecret(), authUserId: authId, viewUserId: readViewUserId }),
    convexServer().query(api.profile.get, { secret: bridgeSecret(), authUserId: authId, viewUserId: readViewUserId }),
  ]);

  const prefs = prefsFromRow(prefRes.row);

  // Latest biomarker per slug (group by slug keeping max date).
  const latestBySlug = new Map<string, (typeof bioRes.rows)[number]>();
  for (const r of bioRes.rows) {
    const cur = latestBySlug.get(r.slug);
    if (!cur || r.date > cur.date) latestBySlug.set(r.slug, r);
  }
  const biomarkers = [...latestBySlug.values()].map((b) => ({
    slug: b.slug, name: b.name, value: b.value, unit: b.unit, refLow: b.refLow, refHigh: b.refHigh, date: b.date,
    optimalLow: META_BY_SLUG[b.slug]?.optimalLow ?? null,
    optimalHigh: META_BY_SLUG[b.slug]?.optimalHigh ?? null,
  }));

  const dnaRows = dnaRes.rows
    .filter((d) => d.userGenotype != null)
    .map((d) => ({ rsid: d.rsid, trait: d.trait, userGenotype: d.userGenotype as string, category: d.category }));

  const engine = runEngine({ biomarkers, dna: dnaRows, prefs });
  const fingerprint = inputFingerprint({ biomarkers, dna: dnaRows, prefs });
  const dataHash = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);

  // profile.data is the field-encrypted blob returned verbatim by Convex; decrypt here.
  const profile = profRes.data ? decryptProfile(JSON.parse(profRes.data)) : {};
  const profileSummary = summarizeProfile(profile);

  const apiKey = anthropicApiKey();
  let plan: NutritionPlan;
  if (!apiKey) {
    plan = fallbackPlan(engine);
  } else {
    try {
      plan = await generatePlan({ apiKey, engine, prefs, profileSummary });
    } catch (e) {
      console.warn("[nutrition] Claude generation failed, using fallback:", e);
      plan = fallbackPlan(engine);
    }
  }

  // Persist as a cacheable report row scoped to this user — but never write to a
  // household member's account while merely viewing it.
  const generatedAt = Date.now();
  const persistedPlan: NutritionPlan = { ...plan, cached: false, generatedAt };
  if (!viewingOther) await convexServer().mutation(api.reports.insert, {
    secret: bridgeSecret(),
    authUserId: authId,
    kind: REPORT_KIND,
    title: `Plan nutrition — ${plan.dietPattern.label}`,
    body: JSON.stringify(persistedPlan),
    meta: JSON.stringify({ generatedAt, dataHash, profileSnapshot: profileSummary }),
  });

  return NextResponse.json(persistedPlan);
}
