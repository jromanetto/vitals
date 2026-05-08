"use client";
import { SectionRenderer } from "./section-renderer";

export const OBJECTIFS_SECTION_IDS = [
  "goals",
  "wearablesOwned",
  "geneticsExtra",
  "advanceDirectives",
];

export function ObjectifsSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return <SectionRenderer ids={OBJECTIFS_SECTION_IDS} {...props} />;
}
