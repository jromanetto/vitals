import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { SymptomDetailClient } from "@/components/symptom-detail-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  energy: "Énergie", mood: "Humeur", focus: "Focus", sleep_quality: "Sommeil",
  gut: "Digestion", skin: "Peau", anxiety: "Anxiété", libido: "Libido", hrv: "HRV",
};

async function load(key: string) {
  ensureSchema();
  const sqlite = db().$client;
  const logs = sqlite.prepare(`SELECT date, value, notes FROM symptom_log WHERE key = ? ORDER BY date ASC`).all(key) as Array<{ date: string; value: number; notes: string | null }>;
  // available biomarkers
  const bms = sqlite.prepare(`SELECT DISTINCT slug, name FROM biomarker ORDER BY name`).all() as Array<{ slug: string; name: string }>;
  return { logs, bms };
}

export default async function SymptomDetail({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { logs, bms } = await load(key);
  const label = LABELS[key] ?? key;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/symptoms" className="text-sm text-muted-foreground hover:text-foreground">← Tous les symptômes</Link>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Symptôme</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{label}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{logs.length} entrées · superposable avec n'importe quel biomarqueur pour visualiser une corrélation.</p>
      </div>
      <SymptomDetailClient symptomKey={key} logs={logs} biomarkers={bms} />
    </div>
  );
}
