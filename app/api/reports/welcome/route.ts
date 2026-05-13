import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
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
  ensureSchema();
  const sqlite = db().$client;

  // Insert the pending report row.
  const result = sqlite
    .prepare(
      `INSERT INTO report (kind, title, body, meta, created_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "welcome",
      "Bienvenue sur Vitals — ton analyse",
      "",
      JSON.stringify({ status: "pending", progress: 0, step: "Préparation" }),
      Date.now(),
      userId,
    );
  const reportId = Number(result.lastInsertRowid);

  // Fire-and-forget: kicks off the generation in the background.
  processWelcomeReport(reportId, userId).catch((e) => {
    console.error("[welcome-report] processing failed", reportId, e);
    try {
      sqlite
        .prepare(`UPDATE report SET meta = ? WHERE id = ?`)
        .run(JSON.stringify({ status: "error", message: (e as Error).message }), reportId);
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
  const sqlite = db().$client;

  const updateMeta = (patch: Record<string, unknown>) => {
    const row = sqlite.prepare(`SELECT meta FROM report WHERE id = ?`).get(reportId) as { meta: string } | undefined;
    const cur = row ? (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta) : {};
    sqlite.prepare(`UPDATE report SET meta = ? WHERE id = ?`).run(JSON.stringify({ ...cur, ...patch }), reportId);
  };

  // Step 1 — pull data.
  updateMeta({ progress: 15, step: "Extraction des biomarqueurs" });

  const profileRow = sqlite
    .prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(userId) as { data: string } | undefined;
  const profile = profileRow ? decryptProfile(typeof profileRow.data === "string" ? JSON.parse(profileRow.data) : profileRow.data) : {};

  // Biomarkers — latest 200 for this user.
  const biomarkers = sqlite
    .prepare(
      `SELECT name, slug, value, unit, ref_low as refLow, ref_high as refHigh, date
       FROM biomarker WHERE user_id = ? ORDER BY date DESC LIMIT 200`,
    )
    .all(userId) as BiomarkerRow[];

  // DNA insights — up to 200.
  updateMeta({ progress: 30, step: "Analyse génétique" });
  const dna = sqlite
    .prepare(
      `SELECT rsid, category, trait, effect, magnitude, risk_allele as riskAllele,
              user_genotype as userGenotype, has_risk as hasRisk, is_protective as isProtective, summary
       FROM dna_insight WHERE user_id = ? ORDER BY magnitude DESC LIMIT 200`,
    )
    .all(userId) as DnaInsightRow[];

  // Step 2 — deterministic signal selection.
  updateMeta({ progress: 45, step: "Sélection des signaux" });
  const signals = selectSignals({ profile, biomarkers, dna });

  // Step 3 — LLM generation.
  updateMeta({ progress: 60, step: "Génération de l'analyse" });
  const { cards, redFlagAlert, bodyMarkdown } = await generateWelcomeReport(signals);

  // Step 4 — persist.
  updateMeta({ progress: 90, step: "Finalisation" });
  sqlite
    .prepare(
      `UPDATE report SET title = ?, body = ?, meta = ? WHERE id = ?`,
    )
    .run(
      "Bienvenue sur Vitals — ton analyse",
      bodyMarkdown,
      JSON.stringify({
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
      reportId,
    );
}
