import { BiomarkerTable } from "@/components/biomarker-table";
import { BloodReportCard } from "@/components/blood-report-card";
import { PageHeader } from "@/components/page-header";
import { Activity } from "lucide-react";
import { SupplementEffectsCard } from "@/components/supplement-effects-card";
import { MissingBiomarkersCard } from "@/components/missing-biomarkers-card";

export const dynamic = "force-dynamic";

export default async function BiomarkersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Biomarqueurs"
        description="Tous tes bilans sanguins, regroupés par système corporel. Chaque biomarqueur affiche la référence labo et la cible longévité."
        icon={<Activity className="h-5 w-5 text-emerald" />}
      />
      <BloodReportCard />
      <SupplementEffectsCard />
      <MissingBiomarkersCard />
      <BiomarkerTable />
    </div>
  );
}
