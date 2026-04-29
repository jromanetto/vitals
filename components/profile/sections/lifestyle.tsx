"use client";
import { SectionRenderer } from "./section-renderer";

export const LIFESTYLE_SECTION_IDS = ["lifestyle", "diet"];

export function LifestyleSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return <SectionRenderer ids={LIFESTYLE_SECTION_IDS} {...props} />;
}
