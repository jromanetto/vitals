import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { FileText, Printer } from "lucide-react";
import { ReportKindPicker } from "@/components/report-kind-picker";
import { ReportsGrid, type ReportRow } from "@/components/reports-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

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

async function getAll(userId: number): Promise<ReportRow[]> {
  ensureSchema();
  const d = db();
  // Nutrition reports (both legacy `nutrition` and the new `nutrition-plan`
  // cache key) store a structured JSON blob consumed by /stack?tab=nutrition —
  // they would render as raw JSON here. Exclude both, they have their
  // dedicated home in Stack.
  const rows = d.$client
    .prepare(
      `SELECT id, kind, title, body, created_at, meta FROM report
       WHERE user_id = ? AND kind NOT IN ('nutrition-plan', 'nutrition')
       ORDER BY created_at DESC`,
    )
    .all(userId) as Array<{ id: number; kind: string; title: string; body: string; created_at: number; meta: string | null }>;
  return rows.map((r) => {
    let parsed: ReportRow["meta"] = null;
    if (r.meta) {
      try { parsed = JSON.parse(r.meta); } catch { parsed = null; }
    }
    return { id: r.id, kind: r.kind, title: r.title, body: r.body, created_at: r.created_at, meta: parsed };
  });
}

export default async function ReportsPage() {
  const userId = await effectiveUserId();
  if (!userId) redirect("/login");
  const rows = await getAll(userId);
  return (
    <div className="space-y-10">
      <PageHeader
        title="Rapports & vue praticien"
        description="Tes documents médicaux générés + une vue praticien live mise à jour automatiquement."
        icon={<FileText className="h-5 w-5 text-emerald" />}
      />

      {/* Live praticien view — always available, no generation needed */}
      <Link
        href="/praticien"
        className="block rounded-xl border border-emerald/40 bg-emerald/5 hover:bg-emerald/10 p-5 transition group"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald font-medium mb-1">Vue praticien · Live</div>
            <h2 className="text-base font-medium tracking-tight">Synthèse à jour à partir de tes données actuelles</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Mise à jour automatiquement à chaque nouveau biomarqueur ou modification du profil. Format A4 imprimable
              pour la consultation médicale.
            </p>
          </div>
          <Printer className="h-5 w-5 text-emerald flex-shrink-0 group-hover:translate-x-0.5 transition" />
        </div>
      </Link>

      <ReportKindPicker kinds={KINDS} />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="Aucun rapport généré"
          description="Génère ton premier rapport depuis l'équipe médicale."
          actionLabel="Demander à l'équipe"
          actionHref="/chat"
        />
      ) : (
        <ReportsGrid rows={rows} />
      )}
    </div>
  );
}
