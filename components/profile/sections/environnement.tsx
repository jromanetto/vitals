"use client";
import { EnvironmentSection } from "@/components/environment-section";

export const ENVIRONNEMENT_SECTION_IDS = ["environment"];

export function EnvironnementSection({
  data,
  onPatch,
}: {
  data: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium tracking-tight">Environnement &amp; exposition</h2>
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
    </div>
  );
}
