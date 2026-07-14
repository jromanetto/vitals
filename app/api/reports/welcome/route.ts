import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { decryptProfile } from "@/lib/crypto-fields";
import { selectSignals, type BiomarkerRow, type DnaInsightRow } from "@/lib/welcome-report/select-signals";
import { generateWelcomeReport } from "@/lib/welcome-report/generate";
import { isWelcomeReportEnabled } from "@/lib/welcome-report/enabled";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/reports/welcome
 *
 * Creates a new welcome report row (status='pending') and fires off the LLM
 * generation in the background, returning the report id immediately. The
 * client polls /api/reports/[id]/status until status='ready' then renders.
 */
export async function POST(_req: Request) {
  if (!isWelcomeReportEnabled()) {
    return NextResponse.json({ error: "Welcome report désactivé temporairement" }, { status: 503 });
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) {
    return NextResponse.json({ error: "Mode démo — pas de génération de report personnalisé" }, { status: 403 });
  }

  // Insert the pending report row (in Convex — the reports UI + status poller
  // read from Convex).
  const { id: reportId } = await convexServer().mutation(api.reports.insert, {
    secret: bridgeSecret(),
    authUserId: userId,
    kind: "welcome",
    title: "Bienvenue sur Vitals — ton analyse",
    body: "",
    meta: JSON.stringify({ status: "pending", progress: 0, step: "Préparation" }),
  });

  // Fire-and-forget: kicks off the generation in the background.
  processWelcomeReport(reportId, userId).catch(async (e) => {
    console.error("[welcome-report] processing failed", reportId, e);
    try {
      await convexServer().mutation(api.reports.updateReport, {
        secret: bridgeSecret(), id: reportId,
        meta: JSON.stringify({ status: "error", message: (e as Error).message }),
      });
    } catch {}
  });

  return NextResponse.json({ id: reportId });
}

/**
 * Async processor — runs the deterministic algo, then up to 3 LLM calls,
 * updating the report.meta with progress along the way so the client polling
 * UI can show a live ticker.
 */
async function processWelcomeReport(reportId: number, userId: number) {
  // Report meta ticker — read/merge/write via Convex (report row lives there).
  const updateMeta = async (patch: Record<string, unknown>) => {
    const { row } = await convexServer().query(api.reports.get, {
      secret: bridgeSecret(), authUserId: userId, viewUserId: userId, id: reportId,
    });
    let cur: Record<string, unknown> = {};
    try { cur = row?.meta ? JSON.parse(row.meta) : {}; } catch {}
    await convexServer().mutation(api.reports.updateReport, {
      secret: bridgeSecret(), id: reportId, meta: JSON.stringify({ ...cur, ...patch }),
    });
  };

  // Step 1 — pull data.
  await updateMeta({ progress: 15, step: "Extraction des biomarqueurs" });

  const { data: profileData } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const profile = profileData ? decryptProfile(JSON.parse(profileData)) : {};

  // Biomarkers — latest 200 for this user (Convex; self-scoped). Convex returns
  // rows date ASC; reproduce the legacy ORDER BY date DESC LIMIT 200.
  const bioRes = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const biomarkers: BiomarkerRow[] = bioRes.rows
    .slice()
    .sort((a, b) => b.date - a.date)
    .slice(0, 200)
    .map((b) => ({ name: b.name, slug: b.slug, value: b.value, unit: b.unit, refLow: b.refLow, refHigh: b.refHigh, date: b.date }));

  // DNA insights — up to 200 (Convex; self-scoped). Reproduce the legacy
  // ORDER BY magnitude DESC (SQLite: NULLs last) LIMIT 200.
  await updateMeta({ progress: 30, step: "Analyse génétique" });
  const dnaRes = await convexServer().query(api.dna.insights, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const dna: DnaInsightRow[] = dnaRes.rows
    .slice()
    .sort((a, b) => {
      if (a.magnitude == null && b.magnitude == null) return 0;
      if (a.magnitude == null) return 1;
      if (b.magnitude == null) return -1;
      return b.magnitude - a.magnitude;
    })
    .slice(0, 200)
    .map((d) => ({
      rsid: d.rsid, category: d.category, trait: d.trait, effect: d.effect,
      magnitude: d.magnitude, riskAllele: d.riskAllele, userGenotype: d.userGenotype,
      hasRisk: !!d.hasRisk, isProtective: !!d.isProtective, summary: d.summary,
    }));

  // Step 2 — deterministic signal selection.
  await updateMeta({ progress: 45, step: "Sélection des signaux" });
  const signals = selectSignals({ profile, biomarkers, dna });

  // Step 3 — LLM generation.
  await updateMeta({ progress: 60, step: "Génération de l'analyse" });
  const { cards, redFlagAlert, bodyMarkdown } = await generateWelcomeReport(signals);

  // Step 4 — persist (title + body + final meta) via Convex.
  await updateMeta({ progress: 90, step: "Finalisation" });
  await convexServer().mutation(api.reports.updateReport, {
    secret: bridgeSecret(),
    id: reportId,
    title: "Bienvenue sur Vitals — ton analyse",
    body: bodyMarkdown,
    meta: JSON.stringify({
      status: "ready",
      progress: 100,
      step: "Prêt",
      cards,
      redFlagAlert,
      signalsSnapshot: {
        card1Kind: signals.card1?.kind,
        card2Kind: signals.card2?.kind,
        card3Kind: signals.card3?.kind,
        biomarkerCount: biomarkers.length,
        dnaCount: dna.length,
        redFlagCount: signals.redFlagAlert?.symptomIds.length ?? 0,
      },
    }),
  });
}
