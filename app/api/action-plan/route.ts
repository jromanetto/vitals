import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { formatProfileForLLM } from "@/lib/profile/format";
import { computeEnvironment } from "@/lib/environment";

export const runtime = "nodejs";
export const maxDuration = 120;

type Pillar = {
  id: "sommeil" | "sport" | "nutrition";
  label: string;
  emoji: string;
  status: "good" | "to-improve" | "alert";
  summary: string;
  goal: string;
  actions: { title: string; detail: string; priority: "high" | "medium" | "low" }[];
};

type Plan = {
  longevityScore: number | null;
  longevitySummary: string;
  pillars: Pillar[];
  topRisks: string[];
  topStrengths: string[];
  generatedAt: number;
};

function readApiKey(): string | null {
  try {
    const raw = readFileSync(path.join(process.cwd(), "data", "auth.json"), "utf8");
    return JSON.parse(raw).anthropicApiKey ?? null;
  } catch { return null; }
}

async function gatherContext(authUserId: number, viewUserId: number) {
  const sqlite = db().$client;

  // Profile (Convex). action-plan reads the raw JSON without field decryption —
  // preserving prior behavior. Convex returns the stored blob verbatim.
  const prof = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId, viewUserId,
  });
  const profile = prof.data ? JSON.parse(prof.data) : {};
  const age = profile.birthDate ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 86400000)) : null;

  // Latest biomarker per slug (Convex returns raw rows; group by slug keeping max date).
  const bioRes = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId, viewUserId,
  });
  const latestBySlug = new Map<string, (typeof bioRes.rows)[number]>();
  for (const r of bioRes.rows) {
    const cur = latestBySlug.get(r.slug);
    if (!cur || r.date > cur.date) latestBySlug.set(r.slug, r);
  }
  const bms = [...latestBySlug.values()]
    .map((b) => ({ slug: b.slug, name: b.name, value: b.value, unit: b.unit, refLow: b.refLow, refHigh: b.refHigh, date: b.date }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Out-of-range biomarkers (status low/high)
  const outOfRange = bms.filter((b) => (b.refLow != null && b.value < b.refLow) || (b.refHigh != null && b.value > b.refHigh));

  // DNA risks + protectives (Convex). Sorted by magnitude desc like the legacy SQL.
  const dnaRes = await convexServer().query(api.dna.insights, {
    secret: bridgeSecret(), authUserId, viewUserId,
  });
  const dnaRisks = dnaRes.rows
    .filter((d) => !!d.hasRisk)
    .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0))
    .slice(0, 15)
    .map((d) => ({ rsid: d.rsid, trait: d.trait, user_genotype: d.userGenotype }));
  const dnaProtective = dnaRes.rows
    .filter((d) => !!d.isProtective)
    .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0))
    .slice(0, 10)
    .map((d) => ({ rsid: d.rsid, trait: d.trait, user_genotype: d.userGenotype }));

  // Active supplements — no Convex fn in scope; stays on SQLite.
  const supplements = sqlite.prepare(`SELECT name, dose, unit, timing, frequency, brand FROM supplement WHERE user_id = ? AND ended_at IS NULL ORDER BY name`).all(viewUserId) as Array<{ name: string; dose: string | null; unit: string | null; timing: string | null; frequency: string | null; brand: string | null }>;

  // Recent wearable averages (last 14 days) via Convex overview, aggregated by kind.
  const wear = await convexServer().query(api.wearables.overview, {
    secret: bridgeSecret(), authUserId, viewUserId, days: 14,
  });
  const wearMap = new Map<string, { sum: number; n: number }>();
  for (const r of wear.rows) {
    const m = wearMap.get(r.kind) ?? { sum: 0, n: 0 };
    m.sum += r.value; m.n += 1;
    wearMap.set(r.kind, m);
  }
  const wearableAvg = [...wearMap.entries()].map(([kind, m]) => ({ kind, avg: Math.round((m.sum / m.n) * 10) / 10, n: m.n }));

  // Recent symptoms — no Convex fn in scope; stays on SQLite.
  let recentSymptoms: Array<{ key: string; intensity: number; date: string }> = [];
  try {
    recentSymptoms = sqlite.prepare(`SELECT key, value as intensity, date FROM symptom_log WHERE user_id = ? AND date >= date('now','-14 days') ORDER BY date DESC LIMIT 30`).all(viewUserId) as Array<{ key: string; intensity: number; date: string }>;
  } catch {}

  // Environment context (city × genes): feeds location-aware advice into the plan.
  let environment = "non renseigné";
  try {
    const env = computeEnvironment(viewUserId);
    if (env.location) {
      environment = [
        `${env.location.label} (lat ~${Math.round(env.location.lat)}°, PM2.5 ${env.location.pm25} µg/m³)`,
        env.sun ? `soleil: ~${env.sun.lowUvMonths} mois/an sans synthèse cutanée de vitamine D${env.sun.geneNames.length ? ` (variants ${env.sun.geneNames.join(", ")})` : ""}` : "",
        env.pollution ? `air: ${env.pollution.tier}` : "",
      ].filter(Boolean).join(" · ");
    }
  } catch { /* best-effort */ }

  return { profile, age, bms, outOfRange, dnaRisks, dnaProtective, supplements, wearableAvg, recentSymptoms, environment };
}

export async function GET(req: Request) {
  const userId = await effectiveUserId();
  const authId = await currentUserId();
  if (!userId || !authId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const viewingOther = userId !== authId; // viewing a household member → never persist
  const readViewUserId = userId; // effectiveUserId (truthy here)
  ensureSchema();

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  // Cache plan for 24h (Convex action_plan, scoped per user via read-user resolution).
  if (!force) {
    const { row } = await convexServer().query(api.reports.latestActionPlan, {
      secret: bridgeSecret(), authUserId: authId, viewUserId: readViewUserId,
    });
    if (row && Date.now() - row.createdAt < 24 * 3600 * 1000) {
      return NextResponse.json({ ...JSON.parse(row.plan), cached: true, generatedAt: row.createdAt });
    }
  }

  const ctx = await gatherContext(authId, readViewUserId);
  const apiKey = readApiKey();
  if (!apiKey) {
    // Fallback: heuristic plan (no Claude)
    const fallback = buildHeuristicPlan(ctx);
    if (!viewingOther) await convexServer().mutation(api.reports.insertActionPlan, {
      secret: bridgeSecret(), authUserId: authId, plan: JSON.stringify(fallback),
    });
    return NextResponse.json({ ...fallback, cached: false });
  }

  const client = new Anthropic({ apiKey });
  const sys = `Tu es une équipe médicale (médecin fonctionnel + nutrithérapeute + coach longévité).
À partir des données suivantes, génère un plan d'action structuré en JSON STRICT pour optimiser la longévité et la forme du patient.
Format de sortie EXACT (aucun préambule, aucun markdown):

{
  "longevityScore": 0-100,
  "longevitySummary": "1 phrase synthétique sur l'état général",
  "pillars": [
    {
      "id": "sommeil",
      "label": "Sommeil",
      "emoji": "🌙",
      "status": "good"|"to-improve"|"alert",
      "summary": "Diagnostic court basé sur HRV, RHR, durée sommeil, score sommeil, dette",
      "goal": "Objectif chiffré et atteignable (ex: HRV >50ms moyenne 90j)",
      "actions": [
        {"title": "Action courte", "detail": "Détail concret 1 phrase max", "priority": "high"|"medium"|"low"}
      ]
    },
    {
      "id": "sport",
      "label": "Sport",
      "emoji": "💪",
      "status": "...",
      "summary": "Basé sur strain, freq workouts, FC max",
      "goal": "Ex: 4 séances/semaine, dont 2 zone 2 + 1 force + 1 HIIT",
      "actions": [...]
    },
    {
      "id": "nutrition",
      "label": "Nutrition",
      "emoji": "🥗",
      "status": "...",
      "summary": "Basé sur biomarqueurs lipides/glycémie/inflammation et nutriments insuffisants",
      "goal": "Ex: ApoB <80, omega-3 index >8%, hsCRP <0.5",
      "actions": [...]
    }
  ],
  "topRisks": ["3-5 risques majeurs identifiés (1 ligne chacun)"],
  "topStrengths": ["3-5 points forts identifiés (1 ligne chacun)"]
}

Règles:
- Actions concrètes, mesurables. Pas de blabla.
- 3 à 5 actions par pilier, triées par priorité.
- Tiens compte des SNPs (ex: COMT Val/Val => stress mgmt; MTHFR => méthylfolate; APOE4 => stricter sur LDL).
- Tiens compte des suppléments déjà pris (ne propose pas ce qui est déjà couvert).
- topRisks et topStrengths transversaux, agrégés depuis biomarqueurs+ADN+wearables.`;

  const userMsg = `Données patient:
${formatProfileForLLM(ctx.profile)}

Biomarqueurs hors range (${ctx.outOfRange.length}/${ctx.bms.length}):
${ctx.outOfRange.map((b) => `- ${b.name} = ${b.value} ${b.unit ?? ""} (réf ${b.refLow}-${b.refHigh})`).join("\n") || "aucun"}

Biomarqueurs récents (top 30):
${ctx.bms.slice(0, 30).map((b) => `- ${b.name} = ${b.value} ${b.unit ?? ""}`).join("\n")}

Variants ADN à risque (${ctx.dnaRisks.length}):
${ctx.dnaRisks.map((d) => `- ${d.rsid} ${d.trait} (${d.user_genotype})`).join("\n") || "aucun"}

Variants ADN protecteurs (${ctx.dnaProtective.length}):
${ctx.dnaProtective.map((d) => `- ${d.rsid} ${d.trait} (${d.user_genotype})`).join("\n") || "aucun"}

Suppléments actifs (${ctx.supplements.length}):
${ctx.supplements.map((s) => `- ${s.name}${s.brand ? ` (${s.brand})` : ""} ${s.dose ?? ""}${s.unit ?? ""} ${s.frequency ?? ""}`).join("\n") || "aucun"}

Wearables (moyennes 14 derniers jours):
${ctx.wearableAvg.map((w) => `- ${w.kind} = ${w.avg} (n=${w.n})`).join("\n") || "aucun"}

Symptômes récents (14j): ${ctx.recentSymptoms.length} entrées
${ctx.recentSymptoms.slice(0, 10).map((s) => `- ${s.key} intensité ${s.intensity} le ${s.date}`).join("\n")}

Environnement (lieu de vie): ${ctx.environment}

Génère le plan JSON.`;

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 3500,
      system: sys,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON in response");
    const plan: Plan = JSON.parse(m[0]);
    plan.generatedAt = Date.now();
    if (!viewingOther) await convexServer().mutation(api.reports.insertActionPlan, {
      secret: bridgeSecret(), authUserId: authId, plan: JSON.stringify(plan),
    });
    return NextResponse.json({ ...plan, cached: false });
  } catch (e) {
    const fallback = buildHeuristicPlan(ctx);
    fallback.longevitySummary = `Plan généré sans IA (${(e as Error).message})`;
    return NextResponse.json({ ...fallback, cached: false, error: (e as Error).message });
  }
}

function buildHeuristicPlan(ctx: Awaited<ReturnType<typeof gatherContext>>): Plan {
  const outBM = ctx.outOfRange;
  const wearable = Object.fromEntries(ctx.wearableAvg.map((w) => [w.kind, w.avg]));
  const hrv = wearable.hrv ?? null;
  const rhr = wearable.rhr ?? null;
  const sleepTotal = wearable.sleep_total_min ?? null;
  const recovery = wearable.recovery ?? null;

  const sommeilStatus: Pillar["status"] = sleepTotal == null ? "to-improve" : sleepTotal >= 420 ? "good" : sleepTotal >= 360 ? "to-improve" : "alert";
  const sportStatus: Pillar["status"] = (wearable.strain_workout ?? 0) >= 8 ? "good" : "to-improve";
  const nutritionStatus: Pillar["status"] = outBM.length === 0 ? "good" : outBM.length <= 3 ? "to-improve" : "alert";

  return {
    longevityScore: Math.max(50, 100 - outBM.length * 4 - (hrv && hrv < 40 ? 8 : 0) - (sleepTotal && sleepTotal < 420 ? 6 : 0)),
    longevitySummary: `${ctx.bms.length} biomarqueurs trackés, ${outBM.length} hors range, ${ctx.supplements.length} suppléments actifs.`,
    pillars: [
      {
        id: "sommeil", label: "Sommeil", emoji: "🌙", status: sommeilStatus,
        summary: `${sleepTotal ? `${(sleepTotal/60).toFixed(1)}h moy.` : "données limitées"}, HRV ${hrv ?? "?"} ms, RHR ${rhr ?? "?"} bpm`,
        goal: "Sommeil 7h+ avec HRV >50ms moyenne 90 jours",
        actions: [
          { title: "Heure de coucher fixe", detail: "Couche-toi à la même heure ±30 min, 7 jours/7", priority: "high" },
          { title: "Black-out total + 18°C", detail: "Chambre dans le noir absolu et fraîche", priority: "high" },
          { title: "Pas d'écran 1h avant", detail: "Limite la lumière bleue après 22h", priority: "medium" },
        ],
      },
      {
        id: "sport", label: "Sport", emoji: "💪", status: sportStatus,
        summary: `${ctx.wearableAvg.find(w => w.kind === "workout_duration_min")?.n ?? 0} entraînements/14j`,
        goal: "4 séances/semaine: 2 zone 2 cardio + 1 force + 1 HIIT",
        actions: [
          { title: "Zone 2 base", detail: "2 séances/sem 45-60 min FC 130-145", priority: "high" },
          { title: "Force composée", detail: "1 séance/sem squat/deadlift/press/row", priority: "high" },
          { title: "HIIT court", detail: "1 séance/sem 4×4 min @VO2max", priority: "medium" },
        ],
      },
      {
        id: "nutrition", label: "Nutrition", emoji: "🥗", status: nutritionStatus,
        summary: outBM.length > 0 ? `${outBM.length} biomarqueurs hors range` : "Biomarqueurs dans les ranges",
        goal: "ApoB <80, omega-3 index >8%, hsCRP <0.5, vit D 50-70 ng/mL",
        actions: [
          { title: "Protéines 1.6 g/kg/jour", detail: "Réparti sur 3-4 repas, source variée", priority: "high" },
          { title: "Légumes 600g/jour", detail: "Couleurs variées + crucifères 4×/sem", priority: "high" },
          { title: "Oméga-3 EPA+DHA 2g/jour", detail: "Si index <8% (carence très commune)", priority: "medium" },
        ],
      },
    ],
    topRisks: outBM.slice(0, 5).map((b) => `${b.name} ${b.value} ${b.unit ?? ""} hors range (${b.refLow}-${b.refHigh})`),
    topStrengths: ctx.dnaProtective.slice(0, 5).map((d) => `${d.trait} (${d.rsid}) – variant protecteur`),
    generatedAt: Date.now(),
  };
}
