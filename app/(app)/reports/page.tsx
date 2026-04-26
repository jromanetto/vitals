import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import Link from "next/link";
import { ReportKindPicker } from "@/components/report-kind-picker";

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

async function getAll() {
  ensureSchema();
  const d = db();
  return d.$client.prepare(`SELECT id, kind, title, created_at FROM report ORDER BY created_at DESC`).all() as Array<{ id: number; kind: string; title: string; created_at: number }>;
}

export default async function ReportsPage() {
  const rows = await getAll();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
        <p className="text-muted-foreground mt-1 text-sm">Synthèses générées par Claude à partir de tes biomarqueurs, ADN et profile.</p>
      </div>

      <ReportKindPicker kinds={KINDS} />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucun rapport encore. Choisis un type ci-dessus pour générer ton premier.</div>}
        {rows.map((r) => (
          <Link key={r.id} href={`/reports/${r.id}`} className="block px-5 py-3 border-t border-border first:border-0 hover:bg-secondary/30 transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 capitalize">{r.kind.replace(/-/g, " ")} · {new Date(r.created_at).toLocaleString("fr-FR")}</div>
              </div>
              <span className="text-muted-foreground text-sm">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
