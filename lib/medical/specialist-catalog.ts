/**
 * Specialists to consult based on profile signals.
 * Triggers same shape as device-catalog.
 */
import type { DeviceTrigger } from "./device-catalog";

export type Specialist = {
  id: string;
  title: string;
  rationale: string;
  triggers: DeviceTrigger[];
};

export const SPECIALIST_CATALOG: Specialist[] = [
  {
    id: "ent-pneumologue",
    title: "Consultation ORL ou pneumologue (apnée)",
    rationale: "Si ronflement + fatigue / brouillard mental persistent, investiguer apnée du sommeil obstructive avant d'investir dans un device.",
    triggers: [
      { kind: "symptom", ids: ["snoring", "fatigue", "brain_fog"], minMatch: 2 },
    ],
  },
  {
    id: "cardio-prevention",
    title: "Cardiologue (consultation prévention)",
    rationale: "ATCD familial cardiopathie précoce + LDL/ApoB borderline = bilan préventif (ECG effort, écho cœur, score calcique).",
    triggers: [
      { kind: "family", diseaseIds: ["mi", "stroke", "sudden_death"] },
      { kind: "age", min: 40 },
    ],
  },
  {
    id: "endocrino-thyroide",
    title: "Endocrinologue (thyroïde)",
    rationale: "ATCD familial Hashimoto / hypothyroïdie + TSH borderline = anti-TPO, anti-Tg, T3 reverse, échographie thyroïdienne.",
    triggers: [
      { kind: "family", diseaseIds: ["thyroid_hypo", "hashimoto"] },
      { kind: "biomarker", slug: "tsh", condition: "borderline" },
    ],
  },
  {
    id: "gastro-coloscopie",
    title: "Gastro-entérologue (coloscopie précoce)",
    rationale: "ATCD familial cancer colorectal direct = coloscopie dès 45 (vs 50 cohorte standard), puis tous les 5 ans.",
    triggers: [
      { kind: "family", diseaseIds: ["cancer_colon"] },
      { kind: "age", min: 40 },
    ],
  },
  {
    id: "urologue-psa",
    title: "Urologue (PSA + toucher rectal)",
    rationale: "ATCD familial cancer prostate = bilan annuel dès 45 ans (vs 50 standard). IRM si PSA >1.5.",
    triggers: [
      { kind: "sex", value: "Homme" },
      { kind: "family", diseaseIds: ["cancer_prostate"] },
      { kind: "age", min: 40 },
    ],
  },
  {
    id: "gyneco-mammo",
    title: "Gynécologue (mammographie précoce)",
    rationale: "ATCD familial cancer du sein = mammo dès 40 ans (-10 ans vs cohorte) + discussion test BRCA selon âge maternel de diagnostic.",
    triggers: [
      { kind: "sex", value: "Femme" },
      { kind: "family", diseaseIds: ["cancer_breast"] },
      { kind: "age", min: 30 },
    ],
  },
  {
    id: "dermato-mole-check",
    title: "Dermatologue (check grains de beauté annuel)",
    rationale: "Si phototype clair + coups de soleil sévères dans le passé, check annuel pour détecter mélanome précoce.",
    triggers: [
      { kind: "symptom", ids: ["new_mole"] },
    ],
  },
  {
    id: "genetique-counsel",
    title: "Consultation génétique (BRCA / Lynch)",
    rationale: "Multiples ATCD cancers familiaux côté direct ou âge précoce de diagnostic = consultation oncogénétique pour évaluer indication test BRCA / Lynch.",
    triggers: [
      { kind: "family", diseaseIds: ["cancer_breast", "cancer_ovary", "cancer_colon", "cancer_uterus"] },
    ],
  },
  {
    id: "psy-mental-load",
    title: "Suivi psy / coaching mental",
    rationale: "Anxiété ≥6/10 + symptômes humeur basse / insomnie = bénéfice d'un suivi psychothérapeutique court (TCC) ou coaching mental.",
    triggers: [
      { kind: "symptom", ids: ["anxiety", "low_mood", "insomnia"], minMatch: 2 },
    ],
  },
  {
    id: "naturopathe-medecine-fonctionnelle",
    title: "Médecin fonctionnel ou naturopathe",
    rationale: "Si tu cherches une approche longévité / optimisation intégrative, complément utile à ton médecin traitant.",
    triggers: [
      { kind: "goal", ids: ["Longévité", "Optimisation cognitive", "Hormones"] },
    ],
  },
];
