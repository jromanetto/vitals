"use client";
import { EnvironmentSection } from "@/components/environment-section";
import { SectionRenderer } from "./section-renderer";

export const ENVIRONNEMENT_SECTION_IDS = [
  "environment",
  "envExposure",
  "topical",
  "socialWork",
];

export function EnvironnementSection({
  data,
  onChange,
  onPatch,
}: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium tracking-tight">Environnement &amp; exposition (lieu)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Lieu de vie, climat, pollution, qualité de l&apos;air et exposition UV.
        </p>
        <div className="mt-5">
          <EnvironmentSection
            current={(data.currentLocation as { countryCode: string; city: string }) || { countryCode: "", city: "" }}
            history={(data.residenceHistory as { countryCode: string; city: string }[]) || []}
            occupation={(data.occupation as string) || ""}
            workEnvironment={(data.workEnvironment as string) || ""}
            toxicExposure={(data.toxicExposure as string) || ""}
            onChange={(patch) => onPatch(patch)}
          />
        </div>
      </section>
      <SectionRenderer ids={["envExposure", "topical", "socialWork"]} data={data} onChange={onChange} />
    </div>
  );
}
