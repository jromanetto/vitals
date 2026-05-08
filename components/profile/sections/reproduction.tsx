"use client";
import { SectionRenderer } from "./section-renderer";

// Combined reproductive section. The wizard chooses to show this tab only when
// data.sex matches; the renderer below picks "womens" or "mens" accordingly.
export const REPRODUCTION_SECTION_IDS = ["reproductive", "womens", "mens"];

export function ReproductionSection({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  const sex = data.sex as string | undefined;
  const ids: string[] = ["reproductive"];
  if (sex === "Femme") ids.push("womens");
  else if (sex === "Homme") ids.push("mens");
  // Intersexe / unknown / not set: show both so user can fill what applies.
  else ids.push("womens", "mens");
  return <SectionRenderer ids={ids} data={data} onChange={onChange} />;
}
