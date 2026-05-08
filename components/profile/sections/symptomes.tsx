"use client";
import { SectionRenderer } from "./section-renderer";

export const SYMPTOMES_SECTION_IDS = ["symptomsActive"];

export function SymptomesSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return <SectionRenderer ids={SYMPTOMES_SECTION_IDS} {...props} />;
}
