import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { SymptomDetailClient } from "@/components/symptom-detail-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  energy: "Énergie", mood: "Humeur", focus: "Focus", sleep_quality: "Sommeil",
  gut: "Digestion", skin: "Peau", anxiety: "Anxiété", libido: "Libido", hrv: "HRV",
};

type SymptomLog = { date: string; value: number; notes: string | null };

// Symptom logs now come from Convex (symptoms domain). The available-biomarkers
// list is a separate domain still on SQLite; left untouched here.
async function loadBiomarkers(userId: number) {
  ensureSchema();
  const sqlite = db().$client;
  return sqlite.prepare(`SELECT DISTINCT slug, name FROM biomarker WHERE user_id = ? ORDER BY name`).all(userId) as Array<{ slug: string; name: string }>;
}

export default async function SymptomDetail({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  let logs: SymptomLog[] = [];
  let bms: Array<{ slug: string; name: string }> = [];
  if (authUserId && viewUserId) {
    const res = await convexServer().query(api.symptoms.byKey, {
      secret: bridgeSecret(),
      authUserId,
      viewUserId,
      key,
    });
    logs = res.rows as SymptomLog[];
    bms = await loadBiomarkers(viewUserId);
  }
  const label = LABELS[key] ?? key;

  return (
    <div className="space-y-10">
      <Link href="/daily" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">← Retour au quotidien</Link>
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">Symptôme</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">{label}</h1>
        <p className="text-muted-foreground mt-3 text-[15px] max-w-2xl">{logs.length} entrées · superposable avec n'importe quel biomarqueur pour visualiser une corrélation.</p>
      </div>
      <SymptomDetailClient symptomKey={key} logs={logs} biomarkers={bms} />
    </div>
  );
}
