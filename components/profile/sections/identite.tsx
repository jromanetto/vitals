"use client";
import { SectionRenderer } from "./section-renderer";
import { AnthroComputed } from "@/components/profile/anthro-computed";

export const IDENTITE_SECTION_IDS = ["identity", "anthro"];

export function IdentiteSection(props: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionRenderer ids={IDENTITE_SECTION_IDS} {...props} />
      <AnthroComputed data={props.data} />
    </div>
  );
}
