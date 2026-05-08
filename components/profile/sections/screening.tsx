"use client";
import { SectionRenderer } from "./section-renderer";

export const SCREENING_SECTION_IDS = ["screeningSchedule"];

export function ScreeningSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return <SectionRenderer ids={SCREENING_SECTION_IDS} {...props} />;
}
