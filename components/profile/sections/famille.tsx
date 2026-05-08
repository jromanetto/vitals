"use client";
import { SectionRenderer } from "./section-renderer";
import { PedigreeEditor } from "@/components/pedigree-editor";

// Order matters: free-text family fields first, then pedigree (alive/age),
// then the structured disease grid (heaviest, most useful for scoring).
export const FAMILLE_SECTION_IDS = ["family", "familyHistory"];

export function FamilleSection({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  const pedigree = (data.pedigree as Record<string, unknown>) ?? {};
  return (
    <div className="space-y-6">
      <SectionRenderer ids={["family"]} data={data} onChange={onChange} />
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium tracking-tight">Pedigree familial</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Histoire de santé sur 3 générations. Plus c&apos;est rempli, mieux les risques héréditaires sont détectés.
        </p>
        <div className="mt-5">
          <PedigreeEditor initial={pedigree} />
        </div>
      </section>
      <SectionRenderer ids={["familyHistory"]} data={data} onChange={onChange} />
    </div>
  );
}
