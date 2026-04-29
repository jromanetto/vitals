import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { FileText } from "lucide-react";
import { ReportKindPicker } from "@/components/report-kind-picker";
import { ReportsGrid, type ReportRow } from "@/components/reports-grid";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

const KINDS = [
  { id: "overview", label: "Vue d'ensemble", desc: "Synthèse globale santé" },
  { id: "longevity", label: "Longévité", desc: "Biomarqueurs et ADN longevity-tilted" },
  { id: "cardiovascular", label: "Cardiovasculaire", desc: "Lipides, inflammation, thrombose" },
  { id: "metabolic", label: "Métabolique", desc: "Glycémie, insuline, lipides, fer" },
  { id: "hormonal", label: "Hormonal", desc: "Testostérone, thyroïde, cortisol" },
  { id: "nutrition", label: "Nutrition", desc: "Nutrigénomique, vitamines, méthylation" },
  { id: "cognition", label: "Cognition", desc: "BDNF, COMT, dopamine" },
  { id: "inflammation", label: "Inflammation", desc: "CRP, IL-6, fibrinogène, ADN" },
  { id: "dna-deep-dive", label: "ADN approfondi", desc: "Analyse complète des 10 catégories" },
  { id: "supplement-recommendations", label: "Suppléments", desc: "Reco basée biomarkers + SNPs" },
  { id: "next-bloodwork-prep", label: "Prochaine prise de sang", desc: "Marqueurs à demander" },
];

async function getAll(): Promise<ReportRow[]> {
  ensureSchema();
  const d = db();
  const rows = d.$client
    .prepare(`SELECT id, kind, title, body, created_at, meta FROM report ORDER BY created_at DESC`)
    .all() as Array<{ id: number; kind: string; title: string; body: string; created_at: number; meta: string | null }>;
  return rows.map((r) => {
    let parsed: ReportRow["meta"] = null;
    if (r.meta) {
      try { parsed = JSON.parse(r.meta); } catch { parsed = null; }
    }
    return { id: r.id, kind: r.kind, title: r.title, body: r.body, created_at: r.created_at, meta: parsed };
  });
}

export default async function ReportsPage() {
  const rows = await getAll();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Synthèses générées par Claude à partir de tes biomarqueurs, ADN et profile.
        </p>
      </div>

      <ReportKindPicker kinds={KINDS} />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="Aucun rapport"
          description="Génère ton premier rapport longévité depuis le panel médical."
          actionLabel="Demander au panel"
          actionHref="/chat"
        />
      ) : (
        <ReportsGrid rows={rows} />
      )}
    </div>
  );
}
