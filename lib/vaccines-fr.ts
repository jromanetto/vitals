// Calendrier vaccinal français — référence Santé Publique France (adultes).
// boosterYears = intervalle de rappel recommandé en années.

export type VaccineRef = {
  id: string;
  name: string;
  recommended: string;
  boosterYears?: number;
};

export const VACCINES: VaccineRef[] = [
  { id: "DTP", name: "DTP (Diphtérie-Tétanos-Polio)", recommended: "Tous adultes", boosterYears: 20 },
  { id: "DTPCa", name: "DTPCa (DTP + Coqueluche)", recommended: "25, 45, 65 ans", boosterYears: 20 },
  { id: "ROR", name: "ROR (Rougeole-Oreillons-Rubéole)", recommended: "Adultes nés après 1980 sans 2 doses" },
  { id: "HepB", name: "Hépatite B", recommended: "Recommandé si exposition" },
  { id: "HepA", name: "Hépatite A", recommended: "Voyageurs zones à risque" },
  { id: "HPV", name: "HPV (Papillomavirus)", recommended: "Jusqu'à 26 ans (filles+garçons)" },
  { id: "Meningo_B", name: "Méningocoque B", recommended: "Nourrissons + adolescents à risque" },
  { id: "Meningo_ACWY", name: "Méningocoque ACWY", recommended: "Adolescents + voyageurs" },
  { id: "COVID", name: "COVID-19", recommended: "Selon recommandations annuelles", boosterYears: 1 },
  { id: "Grippe", name: "Grippe saisonnière", recommended: "Annuel >65 ans + à risque", boosterYears: 1 },
  { id: "Pneumo", name: "Pneumocoque", recommended: ">65 ans + à risque" },
  { id: "Zona", name: "Zona", recommended: ">65 ans" },
  { id: "FJ", name: "Fièvre jaune", recommended: "Voyageurs Afrique sub./Amérique sud", boosterYears: 10 },
  { id: "TyphTAB", name: "Typhoïde", recommended: "Voyageurs Asie/Afrique" },
  { id: "Rage", name: "Rage", recommended: "Voyageurs zones rurales endémiques" },
  { id: "EncephTique", name: "Encéphalite à tiques", recommended: "Forêts Europe centrale/Est" },
  { id: "EncephJap", name: "Encéphalite japonaise", recommended: "Voyageurs ruraux Asie" },
  { id: "BCG", name: "BCG (Tuberculose)", recommended: "Si à risque (peu en France)" },
  { id: "Cholera", name: "Choléra", recommended: "Voyageurs zones épidémiques" },
];

export const VACCINE_BY_ID: Record<string, VaccineRef> = Object.fromEntries(
  VACCINES.map((v) => [v.id, v]),
);

export type VaccineStatus = "ok" | "soon" | "due" | "unknown";

/** Calcule le statut d'un vaccin à partir de la dernière date d'injection. */
export function vaccineStatus(ref: VaccineRef, lastDate?: string): VaccineStatus {
  if (!lastDate) return "unknown";
  if (!ref.boosterYears) return "ok";
  const last = new Date(lastDate).getTime();
  if (Number.isNaN(last)) return "unknown";
  const now = Date.now();
  const yearsMs = ref.boosterYears * 365.25 * 24 * 3600 * 1000;
  const due = last + yearsMs;
  const sixMonthsMs = 182 * 24 * 3600 * 1000;
  if (now > due) return "due";
  if (due - now < sixMonthsMs) return "soon";
  return "ok";
}

/** Retourne la date du prochain rappel (ISO YYYY-MM-DD), ou null. */
export function nextBoosterDate(ref: VaccineRef, lastDate?: string): string | null {
  if (!lastDate || !ref.boosterYears) return null;
  const last = new Date(lastDate);
  if (Number.isNaN(last.getTime())) return null;
  const next = new Date(last);
  next.setFullYear(next.getFullYear() + ref.boosterYears);
  return next.toISOString().slice(0, 10);
}
