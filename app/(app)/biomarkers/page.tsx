import { BiomarkerTable } from "@/components/biomarker-table";
import { SupplementEffectsCard } from "@/components/supplement-effects-card";
import { MissingBiomarkersCard } from "@/components/missing-biomarkers-card";

export const dynamic = "force-dynamic";

export default async function BiomarkersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Biomarkers</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Toutes tes mesures sang, agrégées par marqueur. Cliquez sur un marqueur pour son évolution.
        </p>
      </div>
      <SupplementEffectsCard />
      <MissingBiomarkersCard />
      <BiomarkerTable />
    </div>
  );
}
