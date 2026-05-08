import type { ScreeningEntry, ScreeningHistory, ScreeningCadence } from "./types";

export const SCREENING_CATALOG: ScreeningEntry[] = [
  { id: "checkup", label: "Bilan annuel chez le médecin traitant", cadence: "1y" },
  { id: "blood_panel", label: "Bilan sanguin complet (NFS + iono + lipides + glycémie + foie + rein)", cadence: "1y" },
  { id: "dental", label: "Détartrage / bilan dentaire", cadence: "1y" },
  { id: "vision", label: "Bilan ophtalmologique", cadence: "2y" },
  { id: "hearing", label: "Audiogramme", cadence: "5y", minAge: 50 },
  { id: "skin_check", label: "Check dermato (grains de beauté)", cadence: "1y" },
  { id: "ecg", label: "Électrocardiogramme", cadence: "5y", minAge: 40 },
  { id: "echo_heart", label: "Échographie cardiaque", cadence: "5y", minAge: 50 },
  { id: "stress_test", label: "Test d'effort cardiologique", cadence: "5y", minAge: 50 },
  { id: "colonoscopy", label: "Coloscopie", cadence: "10y", minAge: 45 },
  { id: "fobt", label: "Recherche sang occulte selles (Hémoccult)", cadence: "2y", minAge: 50, maxAge: 74 },
  { id: "dexa", label: "Ostéodensitométrie (DEXA)", cadence: "5y", minAge: 50 },
  { id: "abdo_us", label: "Échographie abdominale (anévrisme)", cadence: "5y", minAge: 65, sex: "male" },

  // Femme
  { id: "pap_smear", label: "Frottis cervico-vaginal", cadence: "3y", sex: "female", minAge: 25, maxAge: 65 },
  { id: "mammography", label: "Mammographie", cadence: "2y", sex: "female", minAge: 50, maxAge: 74 },
  { id: "gyneco", label: "Visite gynéco", cadence: "1y", sex: "female" },
  { id: "hpv_test", label: "Test HPV", cadence: "5y", sex: "female", minAge: 30, maxAge: 65 },

  // Homme
  { id: "psa", label: "PSA + toucher rectal", cadence: "1y", sex: "male", minAge: 50 },
  { id: "testicular", label: "Auto-palpation testiculaire", cadence: "1y", sex: "male" },

  // Vaccins
  { id: "tetanus", label: "Rappel tétanos / dT-Polio", cadence: "10y" },
  { id: "flu", label: "Vaccin grippe", cadence: "1y" },
  { id: "covid", label: "Rappel COVID", cadence: "1y" },
  { id: "shingles", label: "Vaccin zona", cadence: "once", minAge: 65 },
  { id: "pneumo", label: "Vaccin pneumocoque", cadence: "5y", minAge: 65 },
];

const CADENCE_DAYS: Record<ScreeningCadence, number> = {
  "1y": 365,
  "2y": 730,
  "3y": 1095,
  "5y": 1825,
  "10y": 3650,
  once: Infinity,
};

export type ScreeningStatus = "done" | "due" | "overdue" | "upcoming";

export function statusForScreening(
  entry: ScreeningEntry,
  history: ScreeningHistory,
  age: number | undefined,
  sex: "male" | "female" | undefined,
  now: Date = new Date(),
): ScreeningStatus | "na" {
  if (entry.sex && sex && entry.sex !== sex) return "na";
  if (entry.minAge !== undefined && (age === undefined || age < entry.minAge)) return "upcoming";
  if (entry.maxAge !== undefined && age !== undefined && age > entry.maxAge) return "na";
  const last = history[entry.id]?.lastDate;
  if (!last) return "due";
  const lastDate = new Date(last);
  if (Number.isNaN(lastDate.getTime())) return "due";
  const days = (now.getTime() - lastDate.getTime()) / 86_400_000;
  const window = CADENCE_DAYS[entry.cadence];
  if (entry.cadence === "once") return "done";
  if (days < window * 0.9) return "done";
  if (days < window * 1.2) return "due";
  return "overdue";
}

export function applicableScreenings(
  age: number | undefined,
  sex: "male" | "female" | undefined,
): ScreeningEntry[] {
  return SCREENING_CATALOG.filter((e) => {
    if (e.sex && sex && e.sex !== sex) return false;
    if (e.maxAge !== undefined && age !== undefined && age > e.maxAge) return false;
    return true;
  });
}
