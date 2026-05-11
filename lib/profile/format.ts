/**
 * Human-readable profile summary for LLM prompts. Resolves enum IDs from the
 * structured sections (familyHistory, activeSymptoms, screeningHistory) into
 * French labels using the catalogs, so the model reads
 * "Père: diabète type 2 (diagnostiqué à 58 ans)" rather than the raw key
 * "father.t2d".
 *
 * Designed to be injected before the raw JSON dump in chat / action-plan /
 * recommendations prompts so the model can lean on the prose summary while
 * still having access to the exhaustive raw structure.
 */
import { DISEASE_CATALOG } from "@/lib/medical/disease-catalog";
import { SYMPTOM_CATALOG } from "@/lib/medical/symptom-catalog";
import { SCREENING_CATALOG } from "@/lib/medical/screening-catalog";
import { RELATIVES } from "@/lib/medical/relatives";

type AnyRecord = Record<string, unknown>;

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function joinList(items: string[]): string {
  return items.length === 0 ? "—" : items.join(", ");
}

function age(birthDate: string | undefined): number | undefined {
  if (!birthDate) return undefined;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000));
}

function formatFamilyHistory(profile: AnyRecord): string {
  const fh = profile.familyHistory as Record<string, { status?: string; ageOfDiagnosis?: number }> | undefined;
  if (!fh) return "—";
  const byRelative = new Map<string, string[]>();
  for (const [k, entry] of Object.entries(fh)) {
    if (!entry || entry.status !== "yes") continue;
    const [rel, diseaseId] = k.split(".");
    const disease = DISEASE_CATALOG.find((d) => d.id === diseaseId);
    if (!disease) continue;
    const ageBit = entry.ageOfDiagnosis ? ` (à ${entry.ageOfDiagnosis} ans)` : "";
    const list = byRelative.get(rel) ?? [];
    list.push(`${disease.label}${ageBit}`);
    byRelative.set(rel, list);
  }
  if (byRelative.size === 0) return "Aucune maladie héréditaire déclarée";
  const lines: string[] = [];
  for (const r of RELATIVES) {
    const list = byRelative.get(r.key);
    if (list && list.length > 0) lines.push(`- ${r.label}: ${list.join(", ")}`);
  }
  return lines.join("\n");
}

function formatActiveSymptoms(profile: AnyRecord): string {
  if (profile.noActiveSymptoms === true) return "Aucun symptôme actuellement déclaré.";
  const arr = profile.activeSymptoms as string[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  const labels = arr
    .map((id) => SYMPTOM_CATALOG.find((s) => s.id === id))
    .filter((x): x is (typeof SYMPTOM_CATALOG)[number] => !!x);
  if (labels.length === 0) return "—";
  const redFlags = labels.filter((s) => s.redFlag).map((s) => s.label);
  const others = labels.filter((s) => !s.redFlag).map((s) => s.label);
  const parts: string[] = [];
  if (redFlags.length) parts.push(`⚠️ À discuter avec un médecin: ${redFlags.join(", ")}`);
  if (others.length) parts.push(others.join(", "));
  return parts.join(". ");
}

function formatScreening(profile: AnyRecord): string {
  const sh = profile.screeningHistory as Record<string, { lastDate?: string }> | undefined;
  if (!sh) return "—";
  const lines: string[] = [];
  for (const e of SCREENING_CATALOG) {
    const v = sh[e.id]?.lastDate;
    if (v) lines.push(`- ${e.label}: ${v}`);
  }
  return lines.length ? lines.join("\n") : "—";
}

function formatLifestyle(p: AnyRecord): string {
  const parts: string[] = [];
  if (p.activityLevel) parts.push(`Activité: ${asString(p.activityLevel)}`);
  if (p.sleepHours) parts.push(`Sommeil: ${asString(p.sleepHours)}h/nuit`);
  if (p.sleepQuality) parts.push(`Sommeil qualité: ${asString(p.sleepQuality)}`);
  if (p.dietType) parts.push(`Alimentation: ${asString(p.dietType)}`);
  if (p.intermittentFasting) parts.push(`Jeûne intermittent: ${asString(p.intermittentFasting)}`);
  if (p.mealsPerDay) parts.push(`Repas/j: ${asString(p.mealsPerDay)}`);
  if (p.waterLiters) parts.push(`Eau: ${asString(p.waterLiters)}`);
  if (p.alcoholDrinksWeek) parts.push(`Alcool: ${asString(p.alcoholDrinksWeek)} v/sem`);
  if (p.coffeesPerDay) parts.push(`Cafés: ${asString(p.coffeesPerDay)}/j`);
  if (p.smoker) parts.push(`Tabac: ${asString(p.smoker)}`);
  if (p.vaperNicotineMg) parts.push(`Nicotine vape: ${asString(p.vaperNicotineMg)}`);
  if (p.tobaccoPackYears) parts.push(`Pack-years: ${asString(p.tobaccoPackYears)}`);
  return joinList(parts);
}

function formatEnergy(p: AnyRecord): string {
  const parts: string[] = [];
  if (p.energyMorning !== undefined) parts.push(`matin ${asString(p.energyMorning)}/10`);
  if (p.energyAfternoon !== undefined) parts.push(`après-midi ${asString(p.energyAfternoon)}/10`);
  if (p.energyEvening !== undefined) parts.push(`soir ${asString(p.energyEvening)}/10`);
  if (p.postMealCrash) parts.push(`coup de barre post-repas: ${asString(p.postMealCrash)}`);
  if (p.libidoGeneral !== undefined) parts.push(`libido ${asString(p.libidoGeneral)}/10`);
  return joinList(parts);
}

function formatEnvironment(p: AnyRecord): string {
  const parts: string[] = [];
  if (p.waterSource) parts.push(`Eau: ${asString(p.waterSource)}`);
  if (p.airQualityHome !== undefined) parts.push(`Air domicile: ${asString(p.airQualityHome)}/10`);
  if (p.moldHistory) parts.push(`Moisissures: ${asString(p.moldHistory)}`);
  if (p.gasCooking) parts.push(`Cuisson gaz: ${asString(p.gasCooking)}`);
  if (p.urbanRural) parts.push(`Zone: ${asString(p.urbanRural)}`);
  if (p.housingType) parts.push(`Logement: ${asString(p.housingType)}`);
  const occ = p.occupationalHazards as string[] | undefined;
  if (Array.isArray(occ) && occ.length) parts.push(`Expo pro: ${occ.join(", ")}`);
  const pets = p.petsOwned as string[] | undefined;
  if (Array.isArray(pets) && pets.length) parts.push(`Animaux: ${pets.join(", ")}`);
  return joinList(parts);
}

function formatWomens(p: AnyRecord): string {
  if (p.sex !== "Femme") return "";
  const parts: string[] = [];
  if (p.cycleStatus) parts.push(`Cycle: ${asString(p.cycleStatus)}`);
  if (p.menarcheAge) parts.push(`Ménarche: ${asString(p.menarcheAge)} ans`);
  if (p.cycleLength) parts.push(`Durée cycle: ${asString(p.cycleLength)}j`);
  if (p.contraceptionType) parts.push(`Contraception: ${asString(p.contraceptionType)}`);
  if (p.pregnanciesG) parts.push(`G${asString(p.pregnanciesG)}P${asString(p.pregnanciesP) || "?"}`);
  if (p.menopauseStatus) parts.push(`Ménopause: ${asString(p.menopauseStatus)}`);
  if (p.menopauseAge) parts.push(`Âge ménopause: ${asString(p.menopauseAge)}`);
  if (p.hrtFemale && p.hrtFemale !== "no") parts.push(`THS: ${asString(p.hrtFemale)}`);
  return parts.length ? `### Cycle & repro\n${parts.join(" · ")}` : "";
}

function formatMens(p: AnyRecord): string {
  if (p.sex !== "Homme") return "";
  const parts: string[] = [];
  if (p.libidoMale !== undefined) parts.push(`Libido ${asString(p.libidoMale)}/10`);
  if (p.erectileFunction !== undefined) parts.push(`Érection ${asString(p.erectileFunction)}/10`);
  if (p.morningErections) parts.push(`Érections matinales: ${asString(p.morningErections)}`);
  if (p.trtMale && p.trtMale !== "no") parts.push(`TRT: ${asString(p.trtMale)}`);
  if (p.vasectomy && p.vasectomy !== "no") parts.push(`Vasectomie: ${asString(p.vasectomy)}`);
  return parts.length ? `### Repro / uro homme\n${parts.join(" · ")}` : "";
}

function formatDigestion(p: AnyRecord): string {
  const parts: string[] = [];
  if (p.stoolFrequencyDay) parts.push(`Selles/j: ${asString(p.stoolFrequencyDay)}`);
  if (p.bristolType) parts.push(`Bristol: ${asString(p.bristolType)}`);
  if (p.bloating) parts.push(`Ballonnements: ${asString(p.bloating)}`);
  if (p.reflux) parts.push(`Reflux: ${asString(p.reflux)}`);
  if (p.ibsSuspected && p.ibsSuspected !== "no") parts.push(`IBS/SIBO suspecté: ${asString(p.ibsSuspected)}`);
  if (p.lactoseSensitivity && p.lactoseSensitivity !== "no") parts.push(`Lactose: ${asString(p.lactoseSensitivity)}`);
  if (p.glutenSensitivity && p.glutenSensitivity !== "no") parts.push(`Gluten: ${asString(p.glutenSensitivity)}`);
  return joinList(parts);
}

function formatRecovery(p: AnyRecord): string {
  const parts: string[] = [];
  if (p.saunaSessions) parts.push(`Sauna: ${asString(p.saunaSessions)}`);
  if (p.coldExposure) parts.push(`Bain froid: ${asString(p.coldExposure)}`);
  if (p.breathwork) parts.push(`Breathwork: ${asString(p.breathwork)}`);
  if (p.stretching) parts.push(`Étirements: ${asString(p.stretching)}`);
  if (p.massage) parts.push(`Massage: ${asString(p.massage)}`);
  if (p.mobilitySelfRating !== undefined) parts.push(`Mobilité: ${asString(p.mobilitySelfRating)}/10`);
  return joinList(parts);
}

function formatGoals(p: AnyRecord): string {
  const parts: string[] = [];
  const goals = (p.primaryGoals as string[] | undefined) ?? (p.goals as string[] | undefined);
  if (Array.isArray(goals) && goals.length) parts.push(`Objectifs: ${goals.join(", ")}`);
  if (p.longevityTarget) parts.push(`Cible âge santé: ${asString(p.longevityTarget)} ans`);
  if (p.targetWeight) parts.push(`Poids cible: ${asString(p.targetWeight)}kg`);
  if (p.openToHrt) parts.push("Ouvert à hormones/TRT");
  if (p.openToBiohacking) parts.push("Ouvert au biohacking");
  return joinList(parts);
}

function formatWearables(p: AnyRecord): string {
  const w = p.wearables as string[] | undefined;
  if (!Array.isArray(w) || w.length === 0) return "—";
  return w.join(", ");
}

function formatBMI(p: AnyRecord): string {
  const h = Number(p.height) || 0;
  const w = Number(p.weight) || 0;
  if (h <= 0 || w <= 0) return "";
  const m = h / 100;
  const bmi = w / (m * m);
  return ` · IMC ${bmi.toFixed(1)}`;
}

/**
 * Produces a Markdown summary safe to inject in an LLM system or user prompt
 * (no triple-backticks inside, no risky injections).
 */
export function formatProfileForLLM(profile: Record<string, unknown>): string {
  if (!profile || Object.keys(profile).length === 0) {
    return "_Profil non renseigné._";
  }
  const lines: string[] = [];
  const a = age(asString(profile.birthDate));

  lines.push("## Profil patient (résumé lisible)");
  lines.push("");
  // Identité
  const idBits: string[] = [];
  if (profile.firstName) idBits.push(asString(profile.firstName));
  if (profile.lastName) idBits.push(asString(profile.lastName));
  if (a !== undefined) idBits.push(`${a} ans`);
  if (profile.sex) idBits.push(asString(profile.sex));
  if (profile.ethnicity) idBits.push(asString(profile.ethnicity));
  if (idBits.length) lines.push(`**Identité**: ${idBits.join(" · ")}`);
  // Anthro
  const anthro: string[] = [];
  if (profile.height) anthro.push(`${asString(profile.height)} cm`);
  if (profile.weight) anthro.push(`${asString(profile.weight)} kg`);
  if (profile.bodyFat) anthro.push(`${asString(profile.bodyFat)} % MG`);
  if (profile.bloodType) anthro.push(`groupe ${asString(profile.bloodType)}`);
  if (anthro.length) lines.push(`**Anthropométrie**: ${anthro.join(" · ")}${formatBMI(profile)}`);

  // Antécédents médicaux
  const med: string[] = [];
  if (profile.chronicConditions) med.push(`Chroniques: ${asString(profile.chronicConditions)}`);
  if (profile.surgeries) med.push(`Chirurgies: ${asString(profile.surgeries)}`);
  if (profile.hospitalizations) med.push(`Hospitalisations: ${asString(profile.hospitalizations)}`);
  if (med.length) {
    lines.push("");
    lines.push("### Antécédents médicaux");
    for (const m of med) lines.push(`- ${m}`);
  }

  // Famille structurée
  const fam = formatFamilyHistory(profile);
  if (fam !== "—") {
    lines.push("");
    lines.push("### Antécédents familiaux structurés");
    lines.push(fam);
  }

  // Symptômes actifs
  const symp = formatActiveSymptoms(profile);
  if (symp !== "—") {
    lines.push("");
    lines.push("### Symptômes actifs");
    lines.push(symp);
  }

  // Suivi médical
  const screen = formatScreening(profile);
  if (screen !== "—") {
    lines.push("");
    lines.push("### Suivi médical périodique");
    lines.push(screen);
  }

  // Lifestyle
  const lifestyle = formatLifestyle(profile);
  if (lifestyle !== "—") {
    lines.push("");
    lines.push("### Lifestyle");
    lines.push(lifestyle);
  }

  // Digestion
  const digest = formatDigestion(profile);
  if (digest !== "—") {
    lines.push("");
    lines.push("### Digestion");
    lines.push(digest);
  }

  // Énergie
  const en = formatEnergy(profile);
  if (en !== "—") {
    lines.push("");
    lines.push("### Énergie & vitalité");
    lines.push(en);
  }

  // Récupération
  const rec = formatRecovery(profile);
  if (rec !== "—") {
    lines.push("");
    lines.push("### Récupération");
    lines.push(rec);
  }

  // Femme / Homme
  const womens = formatWomens(profile);
  if (womens) {
    lines.push("");
    lines.push(womens);
  }
  const mens = formatMens(profile);
  if (mens) {
    lines.push("");
    lines.push(mens);
  }

  // Environnement
  const env = formatEnvironment(profile);
  if (env !== "—") {
    lines.push("");
    lines.push("### Environnement & exposition");
    lines.push(env);
  }

  // Wearables
  const w = formatWearables(profile);
  if (w !== "—") {
    lines.push("");
    lines.push(`**Wearables**: ${w}`);
  }

  // Objectifs
  const goals = formatGoals(profile);
  if (goals !== "—") {
    lines.push("");
    lines.push("### Objectifs santé");
    lines.push(goals);
  }

  // Notes libres
  if (profile.notes) {
    lines.push("");
    lines.push("### Notes libres");
    lines.push(asString(profile.notes));
  }

  return lines.join("\n");
}
