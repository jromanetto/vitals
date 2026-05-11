"use client";
import { SectionRenderer } from "./section-renderer";

// Single unified view: the structured disease grid (per-relative card + diseases
// per category) replaces the previous legacy "family" textareas + standalone
// PedigreeEditor. Pedigree person info (nom / statut / âge / cause décès) is
// embedded at the top of the grid for the active relative.
export const FAMILLE_SECTION_IDS = ["familyHistory"];

export function FamilleSection({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return <SectionRenderer ids={FAMILLE_SECTION_IDS} data={data} onChange={onChange} />;
}
