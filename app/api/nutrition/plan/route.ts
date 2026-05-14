import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
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

function loadPrefs(sqlite: ReturnType<typeof db>["$client"], userId: number): NutritionPref {
  const row = sqlite.prepare(`SELECT diet_type, allergies, aversions, budget, cuisines FROM nutrition_pref WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as
    | { diet_type: string; allergies: string; aversions: string; budget: string; cuisines: string }
    | undefined;
  if (!row) {
    return { dietType: "omnivore", allergies: [], aversions: "", budget: "medium", cuisines: [] };
  }
  return {
    dietType: row.diet_type as NutritionPref["dietType"],
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
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const url = new URL(req.url);
  // ?refresh=1 (preferred) or legacy ?force=1 forces regeneration
  const force = url.searchParams.get("refresh") === "1" || url.searchParams.get("force") === "1";

  const sqlite = db().$client;

  // Fast path: serve any recent cached plan immediately, scoped to this user
  // so demo accounts never see Julien's plan and vice-versa.
  if (!force) {
    const cached = sqlite.prepare(
      `SELECT body, meta, created_at FROM report WHERE kind = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(REPORT_KIND, userId) as { body: string; meta: string; created_at: number } | undefined;
    if (cached && Date.now() - cached.created_at < CACHE_TTL_MS) {
      try {
        const plan = JSON.parse(cached.body) as NutritionPlan;
        return NextResponse.json({ ...plan, cached: true, generatedAt: cached.created_at });
      } catch {}
    }
  }

  const prefs = loadPrefs(sqlite, userId);

  const latestBms = sqlite.prepare(`
    SELECT b.slug, b.name, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date
    FROM biomarker b
    JOIN (SELECT slug, MAX(date) AS md FROM biomarker WHERE user_id = ? GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date
    WHERE b.user_id = ?
  `).all(userId, userId) as Array<{ slug: string; name: string; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number }>;
  const biomarkers = latestBms.map((b) => ({
    ...b,
    optimalLow: META_BY_SLUG[b.slug]?.optimalLow ?? null,
    optimalHigh: META_BY_SLUG[b.slug]?.optimalHigh ?? null,
  }));

  const dnaRows = sqlite.prepare(`SELECT rsid, trait, user_genotype as userGenotype, category FROM dna_insight WHERE user_genotype IS NOT NULL AND user_id = ?`).all(userId) as Array<{ rsid: string; trait: string; userGenotype: string; category: string }>;

  const engine = runEngine({ biomarkers, dna: dnaRows, prefs });
  const fingerprint = inputFingerprint({ biomarkers, dna: dnaRows, prefs });
  const dataHash = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);

  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as { data: string } | undefined;
  const profile = profileRow ? decryptProfile(JSON.parse(profileRow.data)) : {};
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

  // Persist as a cacheable report row scoped to this user.
  const generatedAt = Date.now();
  const persistedPlan: NutritionPlan = { ...plan, cached: false, generatedAt };
  sqlite.prepare(`INSERT INTO report (kind, title, body, meta, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)`).run(
    REPORT_KIND,
    `Plan nutrition — ${plan.dietPattern.label}`,
    JSON.stringify(persistedPlan),
    JSON.stringify({ generatedAt, dataHash, profileSnapshot: profileSummary }),
    generatedAt,
    userId
  );

  return NextResponse.json(persistedPlan);
}
