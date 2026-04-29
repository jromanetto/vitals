"use client";
import { SectionRenderer } from "./section-renderer";

export const IDENTITE_SECTION_IDS = ["identity", "anthro"];

export function IdentiteSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return <SectionRenderer ids={IDENTITE_SECTION_IDS} {...props} />;
}
