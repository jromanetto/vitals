import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { WelcomeReportClient } from "@/components/welcome-report/welcome-report-client";
import { isWelcomeReportEnabled } from "@/lib/welcome-report/enabled";

export const dynamic = "force-dynamic";

/**
 * Welcome report landing page. Either:
 *  - The user has just finished the upload step → no report yet → trigger creation
 *  - The user already has a recent (last 1h) pending/ready welcome report → show it
 */
export default async function WelcomeReportPage() {
  if (!isWelcomeReportEnabled()) redirect("/dashboard");

  const userId = await currentUserId();
  if (!userId) redirect("/login");
  ensureSchema();
  const sqlite = db().$client;

  // Look for the latest welcome report for this user (report read via Convex;
  // scoped to self — matches the legacy currentUserId-scoped SELECT).
  const { row: recent } = await convexServer().query(api.reports.latestByKind, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId, kind: "welcome",
  });

  let reportId: number;
  let initialMeta: Record<string, unknown> = { status: "pending", progress: 0 };

  if (recent) {
    let parsedMeta: Record<string, unknown> = {};
    try {
      parsedMeta = recent.meta ? (typeof recent.meta === "string" ? JSON.parse(recent.meta) : recent.meta) : {};
    } catch {}

    // Smart regen: if the existing report is empty-state-only (user signed up
    // without uploading, hit /welcome/report, got the placeholder card) but
    // they've since added biomarkers or DNA, throw the placeholder away and
    // generate a fresh report with their real data.
    const cards = (parsedMeta as { cards?: Array<{ kind: string }> }).cards ?? [];
    const isEmptyOnly = cards.length === 1 && cards[0]?.kind === "empty-state";
    if (isEmptyOnly) {
      const hasBiomarkers = sqlite
        .prepare(`SELECT 1 FROM biomarker WHERE user_id = ? LIMIT 1`)
        .get(userId);
      const hasDna = sqlite
        .prepare(`SELECT 1 FROM dna_insight WHERE user_id = ? LIMIT 1`)
        .get(userId);
      if (hasBiomarkers || hasDna) {
        reportId = 0; // client will POST a fresh report
      } else {
        reportId = recent.id;
        initialMeta = parsedMeta;
      }
    } else {
      reportId = recent.id;
      initialMeta = parsedMeta;
    }
  } else {
    // No existing report → client will POST /api/reports/welcome on mount.
    reportId = 0;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald/5 via-background to-background">
      <WelcomeReportClient initialReportId={reportId} initialMeta={initialMeta} />
    </div>
  );
}
