"use client";
import { SectionRenderer } from "./section-renderer";

export const MEDICAL_SECTION_IDS = ["medical", "mental", "reproductive"];

export function MedicalSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return <SectionRenderer ids={MEDICAL_SECTION_IDS} {...props} />;
}
