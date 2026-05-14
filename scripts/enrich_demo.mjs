#!/usr/bin/env node
// Re-seed the demo account as Marc Dupont, 40 yo male — biohacker-leaning
// profile with deep biomarker history (2 years, quarterly panels), structured
// family history, 30 DNA insights, supplement adherence, habits, notes, and
// pre-generated Welcome Report + Doctor Pack.
//
// Idempotent: nukes managed rows for user_id=999 then re-inserts.
// Preserves the wearable_metric data already seeded.
//
// Usage: node scripts/enrich_demo.mjs
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const DB_PATH = process.env.VITALS_DB_PATH || path.join(process.cwd(), "data", "vitals.db");
const USER_ID = 999;

function q(s) { return `'${String(s).replace(/'/g, "''")}'`; }
function sqlite(sql) {
  const r = spawnSync("sqlite3", ["-bail", DB_PATH, sql], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`sqlite3 failed: ${r.stderr || r.stdout}\nSQL: ${sql.slice(0, 200)}`);
  return r.stdout.trim();
}

console.log("Enriching demo account (Marc Dupont, 40 ans, Homme — biohacker profile)…");

// ───────────────────────────────────────────────────────────────
// 1) Wipe managed rows
// ───────────────────────────────────────────────────────────────
for (const table of ["dna_insight", "biomarker", "note", "habit_log", "report", "supplement_log"]) {
  try {
    if (table === "supplement_log") {
      sqlite(`DELETE FROM supplement_log WHERE supplement_id IN (SELECT id FROM supplement WHERE user_id = ${USER_ID})`);
    } else {
      sqlite(`DELETE FROM ${table} WHERE user_id = ${USER_ID}`);
    }
  } catch {}
}

// ───────────────────────────────────────────────────────────────
// 2) Profile — Marc Dupont, 40, male biohacker
// ───────────────────────────────────────────────────────────────
const today = new Date();
const isoDaysAgo = (n) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const tsDaysAgo = (n) => today.getTime() - n * 86_400_000;

const profileData = {
  firstName: "Marc",
  lastName: "Dupont",
  birthDate: "1986-04-12",
  birthPlace: "Lyon, France",
  sex: "Homme",
  gender: "Homme cis",
  ethnicity: "Européenne (Caucasienne)",
  height: 178,
  weight: 76,
  bodyFat: 16,
  muscleMass: 38,
  waist: 84,
  neck: 38,
  bloodType: "O+",
  activityLevel: "Intense (5-6x/sem)",
  trainingHoursWeek: "7-10",
  sleepHours: "7-8",
  sleepQuality: "Bonne",
  wakeTime: "5h-6h",
  screenTime: "5-7h",
  meditation: "Quotidien",
  stressLevel: 5,
  hrv: 62,
  restingHr: 52,
  vo2max: 48,
  dietType: "Méditerranéen",
  intermittentFasting: "16h",
  mealsPerDay: "3",
  waterLiters: "2.5L+",
  alcoholDrinksWeek: "3-5",
  coffeesPerDay: "3",
  smoker: "Non",
  recreationalDrugs: ["Aucune"],
  bedtime: "22h00",
  wakeRegularity: "Très régulier",
  morningLight: "daily",
  blueLightEvening: "rare",
  snoringSuspected: "no",
  restlessLegs: "no",
  shiftWork: "no",
  stoolFrequencyDay: "1-2/jour",
  bristolType: "4 — saucisse lisse (idéal)",
  bloating: "rare",
  reflux: "never",
  ibsSuspected: "no",
  lactoseSensitivity: "no",
  glutenSensitivity: "no",
  lastColonoscopy: "",
  chronicConditions: "Aucune chronique. Léger surpoids résiduel depuis arrêt sport pendant blessure 2022.",
  surgeries: "Réparation ménisque genou droit 2018",
  hospitalizations: "",
  allergies: [
    { name: "Pollen graminées", category: "environnemental", severity: "modérée" },
    { name: "Acariens", category: "environnemental", severity: "légère" },
  ],
  medications: [],
  vaccinationsList: [
    { name: "DTP", lastDate: "2023-06-14" },
    { name: "Grippe", lastDate: "2024-10-15" },
    { name: "COVID", lastDate: "2024-09-20" },
    { name: "Hépatite B", lastDate: "2010-03-18" },
  ],
  familyHistory: {
    "father.htn": { status: "yes", ageOfDiagnosis: 55 },
    "father.t2d": { status: "yes", ageOfDiagnosis: 62 },
    "father.mi": { status: "yes", ageOfDiagnosis: 64 },
    "mother.hashimoto": { status: "yes", ageOfDiagnosis: 48 },
    "mother.osteoporosis": { status: "yes", ageOfDiagnosis: 65 },
    "paternalGrandfather.cancer_prostate": { status: "yes", ageOfDiagnosis: 72 },
    "paternalGrandfather.stroke": { status: "yes", ageOfDiagnosis: 75 },
    "paternalGrandmother.alzheimer": { status: "yes", ageOfDiagnosis: 78 },
    "maternalGrandfather.cancer_colon": { status: "yes", ageOfDiagnosis: 68 },
    "maternalGrandmother.depression": { status: "yes", ageOfDiagnosis: 55 },
    "siblings.depression": { status: "yes", ageOfDiagnosis: 32 },
    "paternalUncleAunt.mi": { status: "yes", ageOfDiagnosis: 58 },
  },
  pedigree: {
    father: { name: "Pierre", alive: "alive", ageOrDeath: "70" },
    mother: { name: "Anne", alive: "alive", ageOrDeath: "67" },
    paternalGrandfather: { name: "Robert", alive: "deceased", ageOrDeath: "78", causeOfDeath: "AVC" },
    paternalGrandmother: { name: "Madeleine", alive: "deceased", ageOrDeath: "84", causeOfDeath: "Alzheimer" },
    maternalGrandfather: { name: "Jacques", alive: "deceased", ageOrDeath: "82", causeOfDeath: "Cancer colorectal" },
    maternalGrandmother: { name: "Suzanne", alive: "alive", ageOrDeath: "89" },
    siblings: [],
    children: [],
  },
  activeSymptoms: ["fatigue", "brain_fog", "low_libido", "joint_pain"],
  noActiveSymptoms: false,
  screeningHistory: {
    blood_panel: { lastDate: isoDaysAgo(45) },
    checkup: { lastDate: isoDaysAgo(180) },
    dental: { lastDate: isoDaysAgo(150) },
    vision: { lastDate: isoDaysAgo(400) },
    skin_check: { lastDate: isoDaysAgo(220) },
    ecg: { lastDate: isoDaysAgo(380) },
    psa: { lastDate: isoDaysAgo(60) },
    testicular: { lastDate: isoDaysAgo(120) },
    flu: { lastDate: isoDaysAgo(210) },
    tetanus: { lastDate: isoDaysAgo(700) },
  },
  moodAvg: 7,
  anxietyLevel: 4,
  cognitiveConcerns: "Brouillard mental après 14h, surtout après gros déjeuner riche en glucides. Mémoire OK.",
  // men's section
  libidoMale: 6,
  erectileFunction: 8,
  morningErections: "often",
  fertilityTested: "no",
  vasectomy: "no",
  trtMale: "no",
  lastPsa: isoDaysAgo(60),
  lastProstateExam: isoDaysAgo(60),
  // dental/vision
  wearsGlasses: "yes",
  visionCorrection: "-2.0",
  lastEyeExam: isoDaysAgo(400),
  tinnitus: "rare",
  hearingLossSuspected: "no",
  bruxism: "rare",
  lastDentalCleaning: isoDaysAgo(150),
  // skin
  skinType: "III — intermédiaire",
  sunHoursWeek: "10-20h",
  sunscreenUse: "sometimes",
  severeBurns: "3-5",
  newMoles: "no",
  lastDermatoCheck: isoDaysAgo(220),
  skinConcerns: ["Aucune"],
  // pain
  hasChronicPain: "yes",
  painIntensity: 3,
  painLocations: ["Genoux", "Dos bas", "Cou / nuque"],
  painDurationYears: 6,
  painTreatments: "Kiné mensuel + étirements quotidiens + glucosamine/chondroïtine en cure",
  // energy
  energyMorning: 8,
  energyAfternoon: 5,
  energyEvening: 6,
  postMealCrash: "often",
  libidoGeneral: 6,
  motivation: 8,
  // recovery
  saunaSessions: "often",
  saunaDurationMin: "15-20",
  coldExposure: "often",
  massage: "sometimes",
  stretching: "daily",
  breathwork: "often",
  mobilitySelfRating: 7,
  balanceFalls: "0",
  // substances
  tobaccoPackYears: "0",
  alcoholBingeWeek: "0",
  cannabisFreq: "never",
  nicotineVaping: "never",
  caffeineLastTime: "14h",
  // social/work
  occupationDetail: "Architecte logiciel — startup biotech",
  remoteWorkPct: "50-75%",
  workStressLevel: 6,
  workHoursWeek: "40-50",
  relationshipStatus: "Marié·e",
  householdComposition: "Couple + enfants",
  lonelinessScale: 2,
  socialInteractionsWeek: "4-6",
  purposeFeel: 9,
  // env
  currentLocation: { countryCode: "FR", city: "Lyon" },
  occupation: "Architecte logiciel",
  workEnvironment: "Bureau partagé + télétravail à domicile",
  toxicExposure: "Aucune connue",
  waterSource: "Robinet filtré",
  airQualityHome: 8,
  moldHistory: "no",
  gasCooking: "no",
  petsOwned: ["Chien"],
  housingType: "Maison",
  urbanRural: "Périurbain",
  noiseExposure: 3,
  occupationalHazards: ["Aucune"],
  // topical
  sunscreenDaily: "no",
  hairDyeFreq: "never",
  makeupDaily: "no",
  fragrancesFreq: "sometimes",
  cleanCosmeticsPref: "no",
  // genetics extra
  brca: "no",
  lynch: "no",
  cardiomyopathyPanel: "no",
  wantsCarrierScreening: "no",
  // wearables
  wearables: ["whoop", "oura", "smartScale", "bpMonitor"],
  wearableMain: "Whoop",
  // advance directives
  emergencyContactName: "Emma Dupont (épouse)",
  emergencyContactPhone: "+33 6 11 22 33 44",
  preferredPharmacy: "Pharmacie Centrale, Lyon 6e",
  organDonor: "yes",
  bloodDonor: "yes",
  advanceDirectivesWritten: "no",
  // goals
  primaryGoals: ["Longévité", "Performance physique", "Optimisation cognitive", "Énergie"],
  currentChallenges: "Atteindre VO2max 50+, normaliser lipides (LDL borderline depuis 2 ans), résoudre brouillard mental post-déjeuner, maintenir libido.",
  targetWeight: 73,
  longevityTarget: 100,
  openToHrt: true,
  openToBiohacking: true,
  // providers
  primaryDoctor: "Dr. Garnier (médecin fonctionnel)",
  specialistsList: [
    { name: "Dr. Petit", specialty: "Cardiologue", lastVisit: isoDaysAgo(380) },
    { name: "Dr. Roux", specialty: "Urologue", lastVisit: isoDaysAgo(60) },
    { name: "Thomas Marin", specialty: "Ostéopathe", lastVisit: isoDaysAgo(30) },
    { name: "Sophie Lambert", specialty: "Naturopathe", lastVisit: isoDaysAgo(90) },
  ],
  preferredLab: "Cerballiance Lyon",
  insurance: "AXA",
  notes: "Cherche optimisation longévité. ATCD familiaux cardio + Alzheimer. Veux comprendre brouillard mental post-déjeuner et améliorer composition corporelle.",
};

sqlite(`UPDATE profile SET data = ${q(JSON.stringify(profileData))}, updated_at = ${Date.now()} WHERE user_id = ${USER_ID}`);
console.log("✓ Profile updated (Marc Dupont, 40 ans, Homme)");

// ───────────────────────────────────────────────────────────────
// 3) Biomarkers — 8 quarterly panels over 2 years, ~25 markers each
// ───────────────────────────────────────────────────────────────
// Each panel = full lipid + glucose + thyroid + liver + kidney + inflammation
// + iron + vitamins + hormones + CBC.

const PANELS = [
  // value drift simulates a man at 40 with borderline LDL improving, ferritin OK, hsCRP varying
  // [days_ago, drift_idx] — drift_idx 0 = oldest panel
];
for (let i = 0; i < 8; i++) PANELS.push([730 - i * 90, i]);

const BMS = [
  // [name, slug, category, unit, refLow, refHigh, baseValue, driftPerPanel, ...]
  ["Cholestérol total", "cholesterol-total", "lipides", "g/L", 1.4, 2.0, 2.05, -0.02],
  ["LDL", "ldl", "lipides", "g/L", 0.0, 1.6, 1.50, -0.03],
  ["HDL", "hdl", "lipides", "g/L", 0.4, null, 0.52, 0.01],
  ["Triglycérides", "triglycerides", "lipides", "g/L", 0.5, 1.5, 1.05, -0.02],
  ["ApoB", "apob", "lipides", "g/L", 0.6, 1.3, 1.15, -0.02],
  ["Lp(a)", "lp-a", "lipides", "mg/dL", 0, 30, 22, 0],
  ["Glycémie à jeun", "glucose", "metabolique", "g/L", 0.7, 1.05, 0.94, -0.005],
  ["HbA1c", "hba1c", "metabolique", "%", 4.0, 5.6, 5.3, -0.02],
  ["Insuline à jeun", "insuline", "metabolique", "µUI/mL", 2, 17, 8, -0.2],
  ["HOMA-IR", "homa-ir", "metabolique", "", 0.5, 2.0, 1.85, -0.05],
  ["Ferritine", "ferritine", "fer", "ng/mL", 30, 300, 145, 5],
  ["Fer sérique", "fer-serique", "fer", "µmol/L", 11, 28, 19, 0.2],
  ["Transferrine", "transferrine", "fer", "g/L", 2.0, 3.6, 2.7, 0],
  ["TSH", "tsh", "thyroide", "mUI/L", 0.4, 4.0, 2.1, -0.05],
  ["T4 libre", "t4-libre", "thyroide", "pmol/L", 12, 22, 16.5, 0.1],
  ["T3 libre", "t3-libre", "thyroide", "pmol/L", 3.5, 6.5, 4.8, 0],
  ["ALAT", "alat", "foie", "UI/L", 0, 41, 28, -0.3],
  ["ASAT", "asat", "foie", "UI/L", 0, 40, 24, 0],
  ["GGT", "ggt", "foie", "UI/L", 0, 60, 38, -0.5],
  ["Phosphatases alcalines", "pal", "foie", "UI/L", 30, 130, 72, 0],
  ["Créatinine", "creatinine", "rein", "mg/L", 7, 13, 9.4, 0],
  ["eGFR", "egfr", "rein", "mL/min/1.73", 90, 200, 105, -0.3],
  ["Urée", "uree", "rein", "g/L", 0.15, 0.45, 0.32, 0],
  ["Acide urique", "acide-urique", "rein", "mg/L", 35, 70, 55, 0.3],
  ["CRP ultrasensible", "hscrp", "inflammation", "mg/L", 0, 1.0, 1.4, -0.05],
  ["Homocystéine", "homocysteine", "inflammation", "µmol/L", 5, 15, 11.5, -0.1],
  ["Vitamine D 25-OH", "vitamine-d-25-oh", "vitamines", "ng/mL", 30, 100, 32, 0.5],
  ["Vitamine B12", "vitamine-b12", "vitamines", "pg/mL", 200, 900, 480, 5],
  ["Folates", "folates-b9", "vitamines", "ng/mL", 4, 20, 9.5, 0],
  ["Magnésium érythrocytaire", "magnesium-erythrocytaire", "mineraux", "mg/L", 47, 65, 52, 0.3],
  ["Zinc sérique", "zinc-serique", "mineraux", "µmol/L", 11, 18, 13.5, 0],
  ["Sélénium", "selenium", "mineraux", "µg/L", 80, 130, 105, 0],
  ["Testostérone totale", "testosterone-totale", "hormones", "ng/dL", 250, 1000, 620, -5],
  ["Testostérone libre", "testosterone-libre", "hormones", "pg/mL", 50, 240, 145, -1],
  ["SHBG", "shbg", "hormones", "nmol/L", 18, 54, 32, 0.2],
  ["DHEA-S", "dhea-s", "hormones", "µg/dL", 110, 510, 280, -2],
  ["Œstradiol", "œstradiol", "hormones", "pg/mL", 10, 40, 28, 0],
  ["Cortisol matin", "cortisol", "hormones", "µg/dL", 6, 23, 14, 0],
  ["IGF-1", "igf-1", "hormones", "ng/mL", 100, 250, 175, -1],
  ["PSA total", "psa", "hormones", "ng/mL", 0, 2.5, 0.8, 0.02],
  ["NFS — Hémoglobine", "hemoglobine", "nfs", "g/dL", 13, 17, 14.8, 0],
  ["NFS — Hématocrite", "hematocrite", "nfs", "%", 40, 52, 45, 0],
  ["NFS — Leucocytes", "leucocytes", "nfs", "10³/µL", 4, 10, 6.2, 0],
  ["NFS — Plaquettes", "plaquettes", "nfs", "10³/µL", 150, 400, 245, 0],
  ["NFS — Lymphocytes", "lymphocytes", "nfs", "%", 20, 40, 32, 0],
  ["NFS — Neutrophiles", "neutrophiles", "nfs", "%", 40, 70, 56, 0],
  ["Index Oméga-3", "omega-3-index", "lipides", "%", 8, 12, 6.5, 0.15],
  ["TGO/TGP ratio", "tgo-tgp-ratio", "foie", "", 0.7, 1.4, 0.85, 0],
  ["Calcium sérique", "calcium-serique", "mineraux", "mg/L", 86, 100, 94, 0],
];

const inserts = [];
for (const [daysAgo, idx] of PANELS) {
  for (const [name, slug, category, unit, refLow, refHigh, baseValue, drift] of BMS) {
    const noise = (Math.random() - 0.5) * 0.04 * baseValue;
    const value = Math.round((baseValue + drift * idx + noise) * 100) / 100;
    inserts.push(
      `(${q(name)}, ${q(slug)}, ${q(category)}, ${value}, ${q(unit)}, ${refLow ?? "NULL"}, ${refHigh ?? "NULL"}, ${tsDaysAgo(daysAgo)}, ${q("Demo seed v2")}, ${q("")}, ${USER_ID})`,
    );
  }
}
// Batch insert in chunks of 50.
for (let i = 0; i < inserts.length; i += 50) {
  const chunk = inserts.slice(i, i + 50);
  sqlite(`INSERT INTO biomarker (name, slug, category, value, unit, ref_low, ref_high, date, source, raw_text, user_id) VALUES ${chunk.join(",")}`);
}
console.log(`✓ Inserted ${inserts.length} biomarker rows (${BMS.length} markers × ${PANELS.length} panels)`);

// ───────────────────────────────────────────────────────────────
// 4) DNA — 30 SNPs covering longevity / cardio / metabolic / cognition / detox
// ───────────────────────────────────────────────────────────────
const dnaInsights = [
  ["rs429358", "longevity", "APOE ε4 status", "Augmente risque Alzheimer si porteur", 4.0, "C", "TT", 0, 1, "Pas porteur d'APOE ε4. Risque Alzheimer aligné population."],
  ["rs7412", "longevity", "APOE ε2 status", "Protection cardio + longévité", 3.5, "T", "CC", 0, 0, "Pas porteur d'ε2. Métabolisme cholestérol standard."],
  ["rs1801131", "metabolic", "MTHFR A1298C", "Réduit conversion folate", 2.5, "G", "GG", 0, 1, "Pas de mutation A1298C — méthylation folate optimale."],
  ["rs1801133", "metabolic", "MTHFR C677T", "Réduit conversion folate", 3.0, "T", "CT", 1, 0, "Hétérozygote: efficacité MTHFR ~65%. Privilégier 5-MTHF + B12 méthylée."],
  ["rs762551", "metabolic", "CYP1A2 caféine", "Métabolisme caféine", 2.0, "A", "AA", 0, 1, "Métaboliseur rapide — bien toléré, mais pas après 14h."],
  ["rs4680", "cognitive", "COMT Val158Met", "Dopamine cortex préfrontal", 2.5, "A", "AA", 0, 1, "Met/Met: profil 'warrior' — dopamine forte sous stress, mais sous tension chronique = burnout."],
  ["rs6265", "cognitive", "BDNF Val66Met", "Plasticité neuronale", 2.5, "A", "GG", 0, 1, "Val/Val: plasticité neuronale optimale, bonne récupération post-stress."],
  ["rs9939609", "metabolic", "FTO", "Risque surpoids", 1.5, "A", "AT", 0, 0, "Hétérozygote: faible tendance accumulation graisse abdominale."],
  ["rs1421085", "metabolic", "FTO leptin", "Signal satiété", 2.0, "C", "TT", 0, 1, "Pas porteur. Régulation appétit normale."],
  ["rs4988235", "metabolic", "LCT lactase persistance", "Tolérance lactose", 3.0, "A", "AA", 0, 1, "Lactase persistante. Lactose toléré toute la vie."],
  ["rs1815739", "fitness", "ACTN3", "Endurance vs puissance", 2.0, "T", "CC", 0, 1, "Variante endurance/puissance — performance polyvalente."],
  ["rs1799945", "metabolic", "HFE H63D", "Surcharge en fer modérée", 2.5, "G", "CG", 1, 0, "Hétérozygote H63D — surveiller ferritine régulièrement (mais reste OK chez toi)."],
  ["rs1800562", "metabolic", "HFE C282Y", "Hémochromatose", 3.5, "A", "GG", 0, 1, "Pas porteur C282Y. Risque hémochromatose minimal."],
  ["rs1800497", "cognitive", "DRD2 Taq1A", "Sensibilité dopamine", 2.0, "A", "GG", 0, 1, "Récompense dopamine normale. Pas de vulnérabilité addiction."],
  ["rs53576", "cognitive", "OXTR (empathie/social)", "Lien social, empathie", 1.5, "G", "AG", 0, 0, "Hétérozygote — empathie standard."],
  ["rs1042713", "fitness", "ADRB2 Arg16Gly", "Réponse cardio + asthme", 1.5, "A", "GG", 0, 0, "Gly/Gly: réponse bronchodilatateurs optimale."],
  ["rs1057910", "metabolic", "CYP2C9*3 (warfarine)", "Métabolisme warfarine", 2.5, "C", "AA", 0, 1, "Métaboliseur normal."],
  ["rs4244285", "metabolic", "CYP2C19*2 (clopidogrel)", "Métaboliseur lent", 2.5, "A", "GG", 0, 1, "Métaboliseur normal — réponse clopidogrel standard."],
  ["rs2228570", "longevity", "VDR FokI vitamine D", "Sensibilité vitamine D", 2.5, "A", "AA", 0, 0, "Variante FF: réponse vitamine D plus faible. Supplémentation à dose haute recommandée."],
  ["rs7041", "longevity", "GC vitamine D binding", "Transport vit D", 2.0, "G", "GT", 0, 0, "Hétérozygote: transport vit D standard."],
  ["rs6025", "cardiovascular", "Factor V Leiden", "Risque thrombose veineuse", 4.0, "T", "CC", 0, 1, "Pas porteur. Risque thrombose minimal."],
  ["rs1799963", "cardiovascular", "Prothrombine G20210A", "Thrombose", 4.0, "A", "GG", 0, 1, "Pas porteur. Risque thrombose minimal."],
  ["rs5882", "longevity", "CETP variant longévité", "HDL haut / longévité", 2.5, "G", "AG", 0, 0, "Hétérozygote — léger avantage HDL."],
  ["rs2802292", "longevity", "FOXO3 longévité", "Allèle G associé longévité +", 3.0, "G", "GG", 0, 1, "Homozygote GG: 2 copies de l'allèle longévité — atout majeur."],
  ["rs7903146", "metabolic", "TCF7L2 (diabète T2)", "Risque diabète T2", 3.5, "T", "CT", 1, 0, "Hétérozygote — risque T2 +30%. Surveiller HbA1c + insuline annuellement (déjà fait ✓)."],
  ["rs1801253", "cardiovascular", "ADRB1 Arg389Gly", "Réponse beta-bloquants", 1.5, "C", "GG", 0, 0, "Profil neutre."],
  ["rs1042522", "cancer", "TP53 codon 72", "Stress cellulaire", 2.0, "G", "GG", 0, 1, "Pro/Pro: meilleure réparation ADN."],
  ["rs17782313", "metabolic", "MC4R (faim)", "Augmente faim ~10%", 1.5, "C", "TT", 0, 1, "Pas porteur. Satiété normale."],
  ["rs602662", "metabolic", "FUT2 (microbiote)", "Diversité microbiote", 1.5, "A", "GG", 0, 0, "Sécréteur normal."],
  ["rs1815739_carrier", "carrier", "SMA carrier (SMN1)", "Mutation récessive transmissible", 2.0, "del", "+/-", 1, 0, "Hétérozygote porteur SMA. Pas de risque pour toi. Pertinent si planification d'enfants — partenaire à dépister."],
];

const dnaInsertSql = dnaInsights
  .map(([rsid, cat, trait, effect, mag, ra, ug, hr, ip, sum]) =>
    `(${q(rsid)}, ${q(cat)}, ${q(trait)}, ${q(effect)}, ${mag}, ${q(ra)}, ${q(ug)}, ${hr}, ${ip}, ${q(sum)}, ${q("Demo seed v2")}, ${USER_ID})`,
  )
  .join(",\n");
sqlite(`INSERT INTO dna_insight (rsid, category, trait, effect, magnitude, risk_allele, user_genotype, has_risk, is_protective, summary, source, user_id) VALUES ${dnaInsertSql}`);
console.log(`✓ Inserted ${dnaInsights.length} DNA insights (29 health + 1 carrier)`);

// ───────────────────────────────────────────────────────────────
// 5) Supplement_log 30d × N supps
// ───────────────────────────────────────────────────────────────
const supps = sqlite(`SELECT id FROM supplement WHERE user_id = ${USER_ID}`).split("\n").filter(Boolean);
let supplementLogCount = 0;
for (const sId of supps) {
  for (let d = 0; d < 30; d++) {
    if (Math.random() > 0.15) {
      sqlite(`INSERT INTO supplement_log (supplement_id, date, taken) VALUES (${sId}, ${q(isoDaysAgo(d))}, 1)`);
      supplementLogCount++;
    }
  }
}
console.log(`✓ Inserted ${supplementLogCount} supplement_log entries`);

// ───────────────────────────────────────────────────────────────
// 6) Habit_log 30d × 6 habits
// ───────────────────────────────────────────────────────────────
const habits = ["meditation", "stretching", "morning_light", "cold_shower", "vegetables", "no_alcohol"];
let habitLogCount = 0;
for (const h of habits) {
  for (let d = 0; d < 30; d++) {
    if (Math.random() > 0.25) {
      sqlite(`INSERT INTO habit_log (date, key, value, user_id) VALUES (${q(isoDaysAgo(d))}, ${q(h)}, 1, ${USER_ID})`);
      habitLogCount++;
    }
  }
}
console.log(`✓ Inserted ${habitLogCount} habit_log entries`);

// ───────────────────────────────────────────────────────────────
// 7) Notes
// ───────────────────────────────────────────────────────────────
const notes = [
  ["biomarker", "ldl", "LDL borderline 1.50 g/L depuis 2 ans. ApoB confirme. ATCD père infarctus 64 ans → vigilance. Cible: <1.30 via régime + cardio + monacolin K."],
  ["biomarker", "homocysteine", "Homocystéine 11.5 µmol/L = haut. Cohérent avec mon MTHFR C677T hétérozygote. Confirme besoin 5-MTHF + B12 méthylée + B6 P5P."],
  ["dna", "rs7903146", "TCF7L2 hétérozygote — risque T2D génétique. Compense par fasting 16h + zone 2 cardio + composition corporelle."],
  ["dna", "rs2802292", "FOXO3 GG homozygote = 2 copies longévité. Atout majeur — à maximiser par calorie restriction occasionnel + sport endurance."],
  ["supplement", "magnesium", "Magnésium glycinate 400mg/soir → sommeil profond +15min selon Whoop. Continuer."],
  ["family", "father", "Père: infarctus à 64 ans. Cible LDL <1.30 obligatoire pour moi (5 ans avant l'âge paternel = 59)."],
  ["dna", "rs1815739_carrier", "Porteur SMA — à dépister chez Emma avant un 3ème enfant."],
];
for (const [tt, tid, body] of notes) {
  sqlite(`INSERT INTO note (target_type, target_id, body, created_at, updated_at, user_id) VALUES (${q(tt)}, ${q(tid)}, ${q(body)}, ${Date.now()}, ${Date.now()}, ${USER_ID})`);
}
console.log(`✓ Inserted ${notes.length} notes`);

// ───────────────────────────────────────────────────────────────
// 8) Welcome Report — pre-generated with 3 spookily specific cards
// ───────────────────────────────────────────────────────────────
const welcomeReportMeta = {
  status: "ready",
  progress: 100,
  step: "Prêt",
  cards: [
    {
      index: 0,
      kind: "biomarker",
      title: "À surveiller",
      body: "Ton LDL est à 1.50 g/L — au-dessus de l'optimal (<1.30) pour un homme de 40 ans. ApoB confirme à 1.15 g/L.\nVu l'infarctus de ton père à 64 ans, ton risque cardio est doublé. Chaque 0.10 g/L de LDL = ~10% risque CV à 10 ans.\nAction: cible <1.30 via 30g fibres/jour + 2g monacolin K (levure de riz rouge) + zone 2 cardio 3x/sem. Recontrôle dans 4 mois.",
    },
    {
      index: 1,
      kind: "dna-protective",
      title: "Force génétique",
      body: "Tu portes deux copies de l'allèle FOXO3 G (rs2802292 GG) — variante longévité majeure, présente chez ~20% des centenaires japonais.\nElle régule l'autophagie cellulaire et la résistance au stress oxydatif. Tu pars avec un avantage génétique sérieux pour atteindre 100 ans.\nMaximise: jeûne intermittent 16h ✓ (que tu fais déjà), zone 2 + sauna fréquent ✓, alimentation méditerranéenne ✓. Continue.",
    },
    {
      index: 2,
      kind: "family-risk",
      title: "Risque familial",
      body: "Ton grand-père paternel a eu un cancer de la prostate à 72 ans. Heritability ~40%, plus risque accru côté paternel direct.\nÀ 40 ans tu es trop jeune pour le dépistage de routine (recommandé dès 50), mais ton PSA actuel à 0.8 ng/mL est rassurant.\nAction: PSA + toucher rectal annuel dès 45 ans (5 ans avant ton âge actuel), examen IRM si PSA augmente >1.5 ng/mL.",
    },
  ],
  signalsSnapshot: { card1Kind: "biomarker", card2Kind: "dna-protective", card3Kind: "family-risk", biomarkerCount: 392, dnaCount: 30, redFlagCount: 0 },
};
const welcomeBodyMd = `# Bienvenue sur ton dossier Vitals

Voici ce qu'on a remarqué dans tes données. Trois choses à actionner.

## À surveiller
${welcomeReportMeta.cards[0].body}

## Force génétique
${welcomeReportMeta.cards[1].body}

## Risque familial
${welcomeReportMeta.cards[2].body}

---
Cette analyse est générée par IA à partir des données que tu nous as fournies. Vitals n'est pas un dispositif médical et ne remplace jamais un avis médical.`;
sqlite(`INSERT INTO report (kind, title, body, meta, created_at, user_id) VALUES (${q("welcome")}, ${q("Bienvenue sur Vitals — ton analyse")}, ${q(welcomeBodyMd)}, ${q(JSON.stringify(welcomeReportMeta))}, ${Date.now()}, ${USER_ID})`);
console.log("✓ Inserted pre-generated Welcome Report");

// ───────────────────────────────────────────────────────────────
// 9) Doctor Pack pré-généré
// ───────────────────────────────────────────────────────────────
const doctorPackBody = `# Dossier médical — Marc Dupont

_Généré le ${new Date().toISOString().slice(0, 10)} · 40 ans · Homme · Lyon_

## Synthèse exécutive

Patient de 40 ans, sportif (5-6x/sem, VO2max 48), pas de pathologie chronique active. **LDL borderline 1.50 g/L** stable sur 8 bilans, **ApoB 1.15** confirme. **ATCD paternel: infarctus 64 ans**, ce qui augmente le risque CV personnel. **Homocystéine 11.5 µmol/L** (haute) cohérente avec MTHFR C677T hétérozygote. TSH stable 2.1, PSA 0.8 (rassurant à 40 ans). **Vitamine D 32 ng/mL** insuffisante (cible 50-80).

## Biomarqueurs hors range ou borderline

- **LDL: 1.50 g/L** (ref <1.6, optimal <1.30) — tendance stable sur 24 mois
- **ApoB: 1.15 g/L** (optimal <1.00) — cohérent avec LDL
- **Homocystéine: 11.5 µmol/L** (optimal <8) — méthylation
- **Vitamine D 25-OH: 32 ng/mL** (optimal 50-80)
- **Index Oméga-3: 6.5%** (optimal >8%)
- **hsCRP: 1.4 mg/L** (optimal <1.0) — légère inflammation chronique

## Examens à programmer

- Bilan martial complet (fer + transferrine + saturation)
- TSH + T3L + T4L + anti-TPO (ATCD maternel Hashimoto)
- **Coronaro-scanner ou score calcique coronarien** vu ATCD paternel infarctus précoce
- **Coloscopie à 45 ans** vu grand-père maternel cancer colorectal à 68 ans
- Lp(a) (mesure unique, génétiquement déterminé)

## Questions à discuter

- Indication monacolin K (levure de riz rouge) 2g/j pour LDL ? Ou statine à faible dose ?
- Test BRCA non indiqué (peu d'ATCD cancers féminins côté famille)
- IRM cardiaque ou simple ECG à l'effort tous les 2 ans ?

---

# Pour mon naturopathe

## Profil ADN actionnable

- **FOXO3 longévité GG homozygote**: atout majeur — maintenir jeûne, sport endurance, sauna
- **APOE ε2/ε4 négatif**: profil neutre
- **MTHFR C677T hétérozygote**: 5-MTHF 400µg/j + B12 méthylée 500µg + B6 P5P 25mg/j
- **TCF7L2 hétérozygote**: risque T2D génétique → maintenir HbA1c <5.4%
- **VDR FokI AA**: réponse vit D faible → supplémentation à 4000 UI/j minimum
- **LCT lactase persistante**: lactose toléré
- **HFE H63D hétérozygote**: surveiller ferritine annuellement (OK actuellement)

## Stack actuel

- Vitamine D3 + K2 (4000 UI / 100 µg) matin
- Magnésium glycinate 400mg soir
- Oméga-3 EPA/DHA 2g matin
- 5-MTHF 400µg + B12 méthylée 500µg matin
- Ashwagandha KSM-66 600mg soir
- (À envisager) Monacolin K 2g/j ou Berbérine 1500mg/j pour LDL

## Mode de vie

- Activité: intense 5-6x/sem (course, vélo, force) — 7-10h/sem
- Sommeil: 7-8h, qualité bonne, régulier (22h-5h30)
- Alimentation: méditerranéenne + IF 16h, 3 repas
- Stress: 5/10, méditation quotidienne, sauna fréquent, bain froid fréquent
- Pas de tabac, alcool 3-5 verres/sem

---

# Suivi mensuel

## Tendances biomarqueurs (24 mois)

- LDL: 1.65 → 1.50 g/L (en baisse ✓ mais toujours hors cible)
- HDL: 0.42 → 0.52 g/L (en hausse, optimal)
- ApoB: 1.30 → 1.15 g/L (baisse ✓)
- HbA1c: 5.6% → 5.3% (✓ optimal)
- Ferritine: 100 → 145 ng/mL (en hausse, OK)
- VO2max: 42 → 48 ml/kg/min (excellent +14%)
- HRV: 48 → 62 ms (+29%)
- Testostérone totale: 680 → 620 ng/dL (légère baisse, surveiller)

## Adhérence supplémentation: 85%

## Symptômes flaggés

- Fatigue post-déjeuner (chronique)
- Brouillard mental après 14h
- Baisse libido (modérée, depuis 6 mois)
- Douleurs articulaires (genou droit chronique post-méniscectomie)`;

sqlite(`INSERT INTO report (kind, title, body, meta, created_at, user_id) VALUES (${q("doctor-pack")}, ${q("Doctor Pack — " + new Date().toISOString().slice(0, 10))}, ${q(doctorPackBody)}, ${q(JSON.stringify({ status: "ready" }))}, ${Date.now()}, ${USER_ID})`);
console.log("✓ Inserted Doctor Pack");

console.log("\n=== Demo enriched ===");
console.log(sqlite(`SELECT
  (SELECT COUNT(*) FROM biomarker WHERE user_id = ${USER_ID}) as bms,
  (SELECT COUNT(DISTINCT slug) FROM biomarker WHERE user_id = ${USER_ID}) as unique_bms,
  (SELECT COUNT(*) FROM dna_insight WHERE user_id = ${USER_ID}) as dna,
  (SELECT COUNT(*) FROM supplement_log WHERE supplement_id IN (SELECT id FROM supplement WHERE user_id = ${USER_ID})) as suplogs,
  (SELECT COUNT(*) FROM habit_log WHERE user_id = ${USER_ID}) as habits,
  (SELECT COUNT(*) FROM note WHERE user_id = ${USER_ID}) as notes,
  (SELECT COUNT(*) FROM report WHERE user_id = ${USER_ID}) as reports`));
console.log("\nLogin: demo@vitals.app via /login?demo=1");

// Suppress unused warnings
void execFileSync;
