import { BiomarkerTable } from "@/components/biomarker-table";
import { BloodReportCard } from "@/components/blood-report-card";
import { PageHeader } from "@/components/page-header";
import { Activity, GitCompare } from "lucide-react";
import { SupplementEffectsCard } from "@/components/supplement-effects-card";
import { MissingBiomarkersCard } from "@/components/missing-biomarkers-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BiomarkersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Biomarqueurs"
        description="Tous tes bilans sanguins, regroupés par système corporel. Chaque biomarqueur affiche la référence labo et la cible longévité."
        icon={<Activity className="h-5 w-5 text-emerald" />}
        actions={
          <Link
            href="/biomarkers/compare"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 hover:bg-secondary/70 px-3 py-1.5 text-xs transition"
          >
            <GitCompare className="h-3.5 w-3.5" /> Comparer
          </Link>
        }
      />
      <BloodReportCard />
      <SupplementEffectsCard />
      <MissingBiomarkersCard />
      <BiomarkerTable />
    </div>
  );
}
