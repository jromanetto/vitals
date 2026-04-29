"use client";
import { SectionRenderer } from "./section-renderer";
import { PedigreeEditor } from "@/components/pedigree-editor";

export const FAMILLE_SECTION_IDS = ["family"];

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
      <SectionRenderer ids={FAMILLE_SECTION_IDS} data={data} onChange={onChange} />
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium tracking-tight">Pedigree familial</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Histoire de santé sur 3 générations. Plus c&apos;est rempli, mieux les risques héréditaires sont détectés.
        </p>
        <div className="mt-5">
          <PedigreeEditor initial={pedigree} />
        </div>
      </section>
    </div>
  );
}
