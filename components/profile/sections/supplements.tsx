"use client";
import { SectionRenderer } from "./section-renderer";

// Supplément référence: defaults that pre-fill the supplements page
// Reuses existing goals + providers + freeform sections (notes that pre-fill IA context).
export const SUPPLEMENTS_SECTION_IDS = ["goals", "providers", "freeform"];

export function SupplementsSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-4 text-sm text-muted-foreground">
        <span className="text-emerald font-medium">Référence suppléments :</span>{" "}
        ces objectifs et notes servent de pré-remplissage intelligent sur la page Suppléments
        (priorités, contraintes, et notes libres pour l&apos;IA).
      </div>
      <SectionRenderer ids={SUPPLEMENTS_SECTION_IDS} {...props} />
    </div>
  );
}
