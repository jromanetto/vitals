import type { Relative } from "./types";

export const RELATIVES: Relative[] = [
  { key: "father", label: "Père", side: "paternal", generation: 1 },
  { key: "mother", label: "Mère", side: "maternal", generation: 1 },
  { key: "paternalGrandfather", label: "Grand-père paternel", side: "paternal", generation: 2 },
  { key: "paternalGrandmother", label: "Grand-mère paternelle", side: "paternal", generation: 2 },
  { key: "maternalGrandfather", label: "Grand-père maternel", side: "maternal", generation: 2 },
  { key: "maternalGrandmother", label: "Grand-mère maternelle", side: "maternal", generation: 2 },
  { key: "siblings", label: "Frère / sœur", side: "common", generation: 0 },
  { key: "children", label: "Enfant", side: "common", generation: 0 },
  { key: "paternalUncleAunt", label: "Oncle / tante paternel·le", side: "paternal", generation: 1 },
  { key: "maternalUncleAunt", label: "Oncle / tante maternel·le", side: "maternal", generation: 1 },
];

export function relativeLabel(key: string): string {
  return RELATIVES.find((r) => r.key === key)?.label ?? key;
}
