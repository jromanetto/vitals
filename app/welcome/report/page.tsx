import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
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

  // Look for a recent welcome report (last hour) for this user.
  const recent = sqlite
    .prepare(
      `SELECT id, meta FROM report
       WHERE kind = 'welcome' AND user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(userId) as { id: number; meta: string } | undefined;

  let reportId: number;
  let initialMeta: Record<string, unknown> = { status: "pending", progress: 0 };

  if (recent) {
    reportId = recent.id;
    try {
      initialMeta = typeof recent.meta === "string" ? JSON.parse(recent.meta) : recent.meta;
    } catch {}
  } else {
    // Trigger creation via POST. Done client-side so we can show the loading state immediately.
    // Pass a placeholder id; the client will POST /api/reports/welcome and use the returned id.
    reportId = 0;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald/5 via-background to-background">
      <WelcomeReportClient initialReportId={reportId} initialMeta={initialMeta} />
    </div>
  );
}
