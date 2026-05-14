#!/usr/bin/env node
// Enrich the demo account (Marie Dupont, user_id=999) so it showcases
// every feature of the new wizard + Welcome Report + Doctor Pack.
//
// Idempotent: deletes the rows it manages then re-inserts.
// Preserves the existing biomarker/wearable_metric data already seeded.
//
// Usage: node scripts/enrich_demo.mjs
import { execFileSync } from "node:child_process";
import path from "node:path";

const DB_PATH = process.env.VITALS_DB_PATH || path.join(process.cwd(), "data", "vitals.db");
const USER_ID = 999;

function q(s) { return `'${String(s).replace(/'/g, "''")}'`; }
function sqlite(sql) {
  const r = execFileSync("sqlite3", ["-bail", DB_PATH, sql], { encoding: "utf8" });
  return r.trim();
}

console.log("Enriching demo account (user_id=999)…");

// ───────────────────────────────────────────────────────────────
// 1) Ensure schema for tables we'll touch
// ───────────────────────────────────────────────────────────────
sqlite(`CREATE TABLE IF NOT EXISTS supplement_log (id INTEGER PRIMARY KEY AUTOINCREMENT, supplement_id INTEGER NOT NULL, date TEXT NOT NULL, taken INTEGER NOT NULL DEFAULT 1)`);
sqlite(`CREATE TABLE IF NOT EXISTS habit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, key TEXT NOT NULL, value REAL NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`);
sqlite(`CREATE TABLE IF NOT EXISTS note (id INTEGER PRIMARY KEY AUTOINCREMENT, target_type TEXT NOT NULL, target_id TEXT NOT NULL, body TEXT NOT NULL, tags TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), updated_at INTEGER NOT NULL DEFAULT 0)`);

// ───────────────────────────────────────────────────────────────
// 2) Wipe & re-insert managed rows (idempotent)
// ───────────────────────────────────────────────────────────────
for (const table of ["dna_insight", "dna_variant", "note", "habit_log", "report", "supplement_log"]) {
  try {
    sqlite(`DELETE FROM ${table} WHERE user_id = ${USER_ID}`);
  } catch {
    // supplement_log doesn't have user_id; nuke via supplement.id
    sqlite(`DELETE FROM supplement_log WHERE supplement_id IN (SELECT id FROM supplement WHERE user_id = ${USER_ID})`);
  }
}

// ───────────────────────────────────────────────────────────────
// 3) Build a complete profile.data using the NEW wizard schema
// ───────────────────────────────────────────────────────────────
const today = new Date();
const isoDaysAgo = (n) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);

const profileData = {
  // identity
  firstName: "Marie",
  lastName: "Dupont",
  birthDate: "1987-03-15",
  birthPlace: "Lyon, France",
  sex: "Femme",
  gender: "Femme cis",
  ethnicity: "Européenne (Caucasienne)",

  // anthro
  height: 168,
  weight: 64,
  bodyFat: 24,
  waist: 76,
  bloodType: "A+",

  // lifestyle (chips)
  activityLevel: "Modéré (3-4x/sem)",
  trainingHoursWeek: "4-6",
  sleepHours: "7-8",
  sleepQuality: "Bonne",
  wakeTime: "6h-7h",
  screenTime: "5-7h",
  meditation: "Hebdo",
  stressLevel: 6,
  hrv: 52,
  restingHr: 58,
  vo2max: 38,

  // diet (chips)
  dietType: "Méditerranéen",
  intermittentFasting: "14h",
  mealsPerDay: "3",
  waterLiters: "1.5-2L",
  alcoholDrinksWeek: "3-5",
  coffeesPerDay: "2",
  smoker: "Non",
  recreationalDrugs: ["Aucune"],

  // sleep extended
  bedtime: "23h00",
  wakeRegularity: "Régulier",
  morningLight: "often",
  blueLightEvening: "sometimes",
  snoringSuspected: "no",
  restlessLegs: "no",
  shiftWork: "no",

  // digestion
  stoolFrequencyDay: "1-2/jour",
  bristolType: "4 — saucisse lisse (idéal)",
  bloating: "sometimes",
  reflux: "rare",
  ibsSuspected: "no",
  lactoseSensitivity: "yes",
  glutenSensitivity: "no",
  lastColonoscopy: "",

  // medical
  chronicConditions: "Hypothyroïdie compensée (Levothyrox 75µg/j depuis 2019)",
  surgeries: "Appendicectomie 2003",
  hospitalizations: "",
  allergies: [
    { name: "Pénicilline", category: "médicament", severity: "modérée" },
    { name: "Pollen graminées", category: "environnemental", severity: "légère" },
  ],
  medications: [
    { name: "Lévothyroxine", dose: "75µg", frequency: "1x/jour", since: "2019-09" },
  ],
  vaccinationsList: [
    { name: "DTP", lastDate: "2021-04-12" },
    { name: "Grippe", lastDate: "2024-10-08" },
    { name: "COVID", lastDate: "2023-11-15" },
  ],

  // family — structured grid (this is the key new feature)
  familyHistory: {
    "mother.thyroid_hypo": { status: "yes", ageOfDiagnosis: 42 },
    "mother.cancer_breast": { status: "yes", ageOfDiagnosis: 58 },
    "father.htn": { status: "yes", ageOfDiagnosis: 50 },
    "father.t2d": { status: "yes", ageOfDiagnosis: 62 },
    "paternalGrandfather.stroke": { status: "yes", ageOfDiagnosis: 78 },
    "paternalGrandfather.mi": { status: "yes", ageOfDiagnosis: 70 },
    "paternalGrandmother.alzheimer": { status: "yes", ageOfDiagnosis: 75 },
    "maternalGrandmother.osteoporosis": { status: "yes", ageOfDiagnosis: 68 },
    "maternalGrandfather.cancer_colon": { status: "yes", ageOfDiagnosis: 72 },
    "siblings.depression": { status: "yes", ageOfDiagnosis: 30 },
  },
  pedigree: {
    father: { name: "Jean", alive: "alive", ageOrDeath: "68" },
    mother: { name: "Catherine", alive: "alive", ageOrDeath: "65" },
    paternalGrandfather: { name: "Pierre", alive: "deceased", ageOrDeath: "82", causeOfDeath: "AVC" },
    paternalGrandmother: { name: "Suzanne", alive: "deceased", ageOrDeath: "85", causeOfDeath: "Alzheimer" },
    maternalGrandfather: { name: "Robert", alive: "deceased", ageOrDeath: "78", causeOfDeath: "Cancer colorectal" },
    maternalGrandmother: { name: "Hélène", alive: "alive", ageOrDeath: "88" },
    siblings: [],
    children: [],
  },

  // active symptoms
  activeSymptoms: ["fatigue", "bloating", "low_libido", "joint_pain"],
  noActiveSymptoms: false,

  // screening
  screeningHistory: {
    blood_panel: { lastDate: isoDaysAgo(45) },
    checkup: { lastDate: isoDaysAgo(120) },
    dental: { lastDate: isoDaysAgo(180) },
    vision: { lastDate: isoDaysAgo(420) },
    pap_smear: { lastDate: isoDaysAgo(700) },
    skin_check: { lastDate: isoDaysAgo(380) },
    gyneco: { lastDate: isoDaysAgo(330) },
  },

  // mental
  moodAvg: 7,
  anxietyLevel: 5,
  cognitiveConcerns: "Petits trous de mémoire, difficulté à se concentrer en fin de journée",

  // women's health (Marie = Femme)
  cycleStatus: "Régulier",
  menarcheAge: 13,
  cycleLength: 28,
  periodLength: 5,
  pms: 5,
  dysmenorrhea: 4,
  contraceptionType: "Stérilet cuivre",
  pregnanciesG: 1,
  pregnanciesP: 1,
  miscarriages: 0,
  breastfeeding: 9,
  menopauseStatus: "Pré-ménopause",
  hrtFemale: "no",
  lastPap: isoDaysAgo(700),
  lastMammo: "",

  // dental / vision / audition
  wearsGlasses: "yes",
  visionCorrection: "-1.5",
  lastEyeExam: isoDaysAgo(420),
  tinnitus: "rare",
  hearingLossSuspected: "no",
  bruxism: "sometimes",
  lastDentalCleaning: isoDaysAgo(180),

  // skin
  skinType: "II — claire",
  sunHoursWeek: "5-10h",
  sunscreenUse: "often",
  severeBurns: "1-2",
  newMoles: "no",
  lastDermatoCheck: isoDaysAgo(380),
  skinConcerns: ["Sécheresse", "Sensibilité"],

  // pain
  hasChronicPain: "yes",
  painIntensity: 4,
  painLocations: ["Cou / nuque", "Dos haut", "Lombaires"],
  painDurationYears: 3,
  painTreatments: "Ostéo trimestriel + étirements quotidiens",

  // energy
  energyMorning: 6,
  energyAfternoon: 4,
  energyEvening: 5,
  postMealCrash: "often",
  libidoGeneral: 5,
  motivation: 7,

  // recovery
  saunaSessions: "rare",
  saunaDurationMin: "10-15",
  coldExposure: "never",
  massage: "sometimes",
  stretching: "daily",
  breathwork: "sometimes",
  mobilitySelfRating: 6,
  balanceFalls: "0",

  // substances
  tobaccoPackYears: "0",
  alcoholBingeWeek: "0",
  cannabisFreq: "never",
  nicotineVaping: "never",
  caffeineLastTime: "midi",

  // social work
  occupationDetail: "Designer UX freelance",
  remoteWorkPct: "75-100%",
  workStressLevel: 6,
  workHoursWeek: "30-40",
  relationshipStatus: "En couple",
  householdComposition: "Couple + enfants",
  lonelinessScale: 3,
  socialInteractionsWeek: "2-3",
  purposeFeel: 8,

  // environment
  currentLocation: { countryCode: "FR", city: "Lyon" },
  occupation: "Designer UX",
  workEnvironment: "Bureau à domicile, lumière naturelle",
  toxicExposure: "Aucune connue",
  waterSource: "Robinet filtré",
  airQualityHome: 7,
  moldHistory: "no",
  gasCooking: "yes",
  petsOwned: ["Chat"],
  housingType: "Appartement",
  urbanRural: "Urbain",
  noiseExposure: 4,
  occupationalHazards: ["Aucune"],

  // topical
  sunscreenDaily: "yes",
  hairDyeFreq: "rare",
  makeupDaily: "yes",
  fragrancesFreq: "often",
  cleanCosmeticsPref: "yes",

  // genetics extra
  brca: "no",
  lynch: "no",
  cardiomyopathyPanel: "no",
  wantsCarrierScreening: "yes",

  // wearables
  wearables: ["oura", "appleWatch"],
  wearableMain: "Oura",

  // advance directives
  emergencyContactName: "Thomas Dupont (mari)",
  emergencyContactPhone: "+33 6 12 34 56 78",
  preferredPharmacy: "Pharmacie de la République, Lyon 3e",
  organDonor: "yes",
  bloodDonor: "no",
  advanceDirectivesWritten: "no",

  // goals
  primaryGoals: ["Énergie", "Hormones", "Longévité", "Réduction stress"],
  currentChallenges: "Fatigue persistante l'après-midi, brouillard mental, libido en baisse depuis 6 mois",
  targetWeight: 60,
  longevityTarget: 95,
  openToHrt: false,
  openToBiohacking: true,

  // providers
  primaryDoctor: "Dr. Lefèvre (généraliste)",
  specialistsList: [
    { name: "Dr. Moreau", specialty: "Endocrinologue", lastVisit: isoDaysAgo(180) },
    { name: "Dr. Bernard", specialty: "Gynécologue", lastVisit: isoDaysAgo(330) },
    { name: "Marc Lambert", specialty: "Ostéopathe", lastVisit: isoDaysAgo(45) },
  ],
  preferredLab: "Cerballiance Lyon",
  insurance: "MGEN",

  // notes
  notes: "Recherche un suivi longévité actif. Sensibilité au lactose découverte récemment. Veux comprendre la fatigue chronique post-grossesse.",
};

sqlite(`UPDATE profile SET data = ${q(JSON.stringify(profileData))}, updated_at = ${Date.now()} WHERE user_id = ${USER_ID}`);
console.log("✓ Profile updated with full new-wizard schema");

// ───────────────────────────────────────────────────────────────
// 4) Seed 30 DNA insights (well-known SNPs)
// ───────────────────────────────────────────────────────────────
const dnaInsights = [
  ["rs429358", "longevity", "APOE ε4 carrier (risque Alzheimer)", "Augmente risque Alzheimer 3-4x", 4.0, "C", "TT", 0, 1, "Bonne nouvelle: tu n'es pas porteuse de APOE ε4. Risque Alzheimer aligné population générale."],
  ["rs7412", "longevity", "APOE ε2 carrier (protection)", "Diminue risque Alzheimer ~40%", 3.5, "T", "CT", 0, 1, "Tu portes une copie d'APOE ε2 — variante associée à protection cardiovasculaire et longévité accrue."],
  ["rs1801131", "metabolic", "MTHFR A1298C", "Réduit conversion folate", 2.5, "G", "AG", 1, 0, "Hétérozygote: efficacité MTHFR modérément réduite. Privilégier folate méthylé (5-MTHF)."],
  ["rs1801133", "metabolic", "MTHFR C677T", "Réduit conversion folate", 3.0, "T", "CC", 0, 1, "Pas de mutation C677T. Métabolisme du folate normal."],
  ["rs762551", "metabolic", "CYP1A2 (caféine)", "Métabolisme caféine rapide", 2.0, "A", "AA", 0, 1, "Métaboliseur rapide de caféine. Tu peux tolérer plus, mais évite après 14h."],
  ["rs4680", "cognitive", "COMT Val158Met", "Affecte dopamine cortex préfrontal", 2.5, "A", "GA", 0, 0, "Hétérozygote (Val/Met): équilibre flexibilité/persistance. Pas de risque clair."],
  ["rs6265", "cognitive", "BDNF Val66Met", "Plasticité neuronale", 2.5, "A", "GG", 0, 1, "Pas de variante Met. Plasticité neuronale optimale."],
  ["rs9939609", "metabolic", "FTO (poids/satiété)", "Risque obésité +1.7kg", 1.5, "A", "TT", 0, 1, "Variante TT: risque génétique de surpoids minimal."],
  ["rs1421085", "metabolic", "FTO leptin", "Affecte signaux satiété", 2.0, "C", "TT", 0, 1, "Tu n'es pas porteuse. Régulation appétit standard."],
  ["rs4988235", "metabolic", "LCT lactase persistance", "Tolérance lactose", 3.0, "A", "GG", 1, 0, "Génotype GG: lactase peu persistante. Cohérent avec ta sensibilité au lactose ressentie."],
  ["rs1815739", "longevity", "ACTN3 (sport endurance vs puissance)", "Profil endurance", 2.0, "T", "CT", 0, 0, "Hétérozygote: profil mixte endurance/puissance."],
  ["rs17782313", "metabolic", "MC4R (faim)", "Augmente faim ~10%", 1.5, "C", "TT", 0, 1, "Pas de variante: signal de satiété normal."],
  ["rs1799945", "metabolic", "HFE H63D", "Surcharge en fer modérée", 2.5, "G", "CC", 0, 1, "Pas de mutation. Métabolisme du fer normal."],
  ["rs1800562", "metabolic", "HFE C282Y (hémochromatose)", "Surcharge en fer sévère", 3.5, "A", "GG", 0, 1, "Pas de mutation. Risque hémochromatose minimal."],
  ["rs1800497", "cognitive", "DRD2 Taq1A (récompense)", "Sensibilité dopamine", 2.0, "A", "GA", 0, 0, "Hétérozygote: réponse récompense modérée."],
  ["rs53576", "cognitive", "OXTR (empathie/social)", "Variante GG = empathie élevée", 1.5, "G", "GG", 0, 1, "Variante GG associée à empathie + lien social plus forts."],
  ["rs1042713", "cardiovascular", "ADRB2 (asthme/cardio)", "Réponse beta2-agonistes", 1.5, "A", "GG", 0, 0, "Profil neutre."],
  ["rs1057910", "metabolic", "CYP2C9*3 (warfarine)", "Métabolisme warfarine lent", 2.5, "C", "AA", 0, 1, "Métaboliseur rapide. Pas d'ajustement warfarine."],
  ["rs4244285", "metabolic", "CYP2C19*2 (clopidogrel)", "Métaboliseur lent", 2.5, "A", "GG", 0, 1, "Métaboliseur normal. Réponse clopidogrel standard."],
  ["rs1799853", "metabolic", "CYP2C9*2", "Métabolisme variable", 2.0, "T", "CC", 0, 1, "Profil normal."],
  ["rs2228570", "longevity", "VDR FokI (vitamine D)", "Sensibilité vitamine D", 2.5, "A", "AG", 0, 0, "Hétérozygote: réponse modérée à la vitamine D. Surveille tes niveaux."],
  ["rs7041", "longevity", "GC vitamine D binding", "Transport vit D", 2.0, "G", "TT", 0, 0, "Profil neutre."],
  ["rs602662", "metabolic", "FUT2 (microbiote)", "Présence Bifidobactéries", 1.5, "A", "GG", 0, 0, "Sécréteur normal. Microbiote diversifié possible."],
  ["rs6025", "cardiovascular", "Factor V Leiden (thrombose)", "Risque thrombose veineuse", 4.0, "T", "CC", 0, 1, "Pas de mutation Factor V Leiden. Risque thrombose normal."],
  ["rs1799963", "cardiovascular", "Prothrombine G20210A", "Thrombose", 4.0, "A", "GG", 0, 1, "Pas de mutation. Risque thrombose normal."],
  ["rs5882", "longevity", "CETP (cholestérol)", "Variante longévité", 2.5, "G", "AA", 0, 0, "Pas d'allèle de longévité. Aligné population."],
  ["rs2802292", "longevity", "FOXO3 (longévité)", "Allèle G associé longévité", 3.0, "G", "TG", 0, 1, "Hétérozygote: 1 copie de l'allèle longévité G — léger avantage."],
  ["rs7903146", "metabolic", "TCF7L2 (diabète T2)", "Risque diabète T2", 3.5, "T", "CC", 0, 1, "Génotype CC protecteur. Risque diabète T2 minimal côté génétique."],
  ["rs1801253", "cardiovascular", "ADRB1 Arg389Gly", "Réponse beta-bloquants", 1.5, "C", "GG", 0, 0, "Profil normal."],
  ["rs1042522", "cancer", "TP53 codon 72", "Réponse stress cellulaire", 2.0, "G", "GC", 0, 0, "Hétérozygote Pro/Arg: équilibre apoptose/réparation."],
];

const dnaInsertSql = dnaInsights
  .map(([rsid, cat, trait, effect, mag, ra, ug, hr, ip, sum]) =>
    `(${q(rsid)}, ${q(cat)}, ${q(trait)}, ${q(effect)}, ${mag}, ${q(ra)}, ${q(ug)}, ${hr}, ${ip}, ${q(sum)}, ${q("Demo seed")}, ${USER_ID})`,
  )
  .join(",\n");
sqlite(`INSERT INTO dna_insight (rsid, category, trait, effect, magnitude, risk_allele, user_genotype, has_risk, is_protective, summary, source, user_id) VALUES ${dnaInsertSql}`);
console.log(`✓ Inserted ${dnaInsights.length} DNA insights`);

// ───────────────────────────────────────────────────────────────
// 5) Seed 30 days of supplement_log (adherence ~80%)
// ───────────────────────────────────────────────────────────────
const supps = sqlite(`SELECT id FROM supplement WHERE user_id = ${USER_ID}`).split("\n").filter(Boolean);
let supplementLogCount = 0;
for (const sId of supps) {
  for (let d = 0; d < 30; d++) {
    if (Math.random() > 0.2) {
      sqlite(`INSERT INTO supplement_log (supplement_id, date, taken) VALUES (${sId}, ${q(isoDaysAgo(d))}, 1)`);
      supplementLogCount++;
    }
  }
}
console.log(`✓ Inserted ${supplementLogCount} supplement_log entries (30d × ${supps.length} supps)`);

// ───────────────────────────────────────────────────────────────
// 6) Seed 30 days of habit_log (5 habits × 30 days, ~70% adherence)
// ───────────────────────────────────────────────────────────────
const habits = ["meditation", "stretching", "morning_light", "no_alcohol", "vegetables"];
let habitLogCount = 0;
for (const h of habits) {
  for (let d = 0; d < 30; d++) {
    if (Math.random() > 0.3) {
      sqlite(`INSERT INTO habit_log (date, key, value, user_id) VALUES (${q(isoDaysAgo(d))}, ${q(h)}, 1, ${USER_ID})`);
      habitLogCount++;
    }
  }
}
console.log(`✓ Inserted ${habitLogCount} habit_log entries`);

// ───────────────────────────────────────────────────────────────
// 7) Seed 5 notes
// ───────────────────────────────────────────────────────────────
const notes = [
  ["biomarker", "ferritine", "Ferritine basse depuis 2 ans malgré supplémentation. Demander un fer sérique + transferrine au prochain bilan."],
  ["biomarker", "tsh", "TSH stable sous Lévothyrox 75µg. Dr Moreau veut ajuster à 87.5µg si symptômes persistent."],
  ["dna", "rs4988235", "Confirme l'intolérance lactose ressentie depuis ado. Lait sans lactose OK."],
  ["supplement", "magnesium", "Pris le soir → meilleur sommeil immédiatement. Continuer."],
  ["family", "mother", "Mère: cancer du sein 58 ans → discuter mammo précoce avec Dr Bernard."],
];
for (const [tt, tid, body] of notes) {
  sqlite(`INSERT INTO note (target_type, target_id, body, created_at, updated_at, user_id) VALUES (${q(tt)}, ${q(tid)}, ${q(body)}, ${Date.now()}, ${Date.now()}, ${USER_ID})`);
}
console.log(`✓ Inserted ${notes.length} notes`);

// ───────────────────────────────────────────────────────────────
// 8) Seed 1 pre-generated Welcome Report (so demo lands on something showy)
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
      body: "Ta ferritine est à 24 ng/mL — sous la zone optimale (70-120). Combiné à ta fatigue persistante l'après-midi, c'est un signal clair de carence en réserves de fer.\nAction: demande fer sérique + saturation transferrine au prochain bilan, puis discute supplémentation avec ton médecin.",
    },
    {
      index: 1,
      kind: "dna-protective",
      title: "Force génétique",
      body: "Tu portes une copie d'APOE ε2 (rs7412 CT) — variante associée à une protection cardiovasculaire et un risque Alzheimer réduit.\nMaximise cet atout: alimentation méditerranéenne (que tu fais déjà ✓), oméga-3 réguliers, sport endurance.",
    },
    {
      index: 2,
      kind: "family-risk",
      title: "Risque familial",
      body: "Ta mère a eu un cancer du sein à 58 ans. Heritability ~30%, plus risque accru côté maternel.\nAction: mammographie précoce dès 40 ans (5 ans avant l'âge moyen de diagnostic familial), discuss BRCA test avec Dr Bernard.",
    },
  ],
  signalsSnapshot: { card1Kind: "biomarker", card2Kind: "dna-protective", card3Kind: "family-risk", biomarkerCount: 52, dnaCount: 30, redFlagCount: 0 },
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
// 9) Seed 1 sample Doctor Pack
// ───────────────────────────────────────────────────────────────
const doctorPackBody = `# Dossier médical — Marie Dupont

_Généré le ${new Date().toISOString().slice(0, 10)} · 38 ans · Femme · Lyon_

## Synthèse exécutive

Patiente de 38 ans, hypothyroïdie compensée sous Lévothyroxine 75µg/j depuis 2019. Bilan ${isoDaysAgo(45)} montre une **ferritine basse (24 ng/mL)** confirmée par tendance descendante sur 3 bilans annuels successifs. **TSH stable** dans la zone basse (1.2 mUI/L). Antécédents familiaux notables : **cancer du sein maternel à 58 ans**, hypothyroïdie maternelle, AVC + infarctus paternel.

## Biomarqueurs hors range

- **Ferritine: 24 ng/mL** (ref 30-300, optimal 70-120) — Tendance baissière sur 3 ans.
- Vitamine D: 22 ng/mL (ref 30-100, optimal 50-80) — Carence modérée.
- Homocystéine: 11.2 µmol/L (ref <12, optimal <8) — Tendance haute.

## Examens à programmer

- Bilan martial complet (fer sérique + transferrine + saturation + CRP)
- TSH + T3L + T4L (suivi thyroïdien semi-annuel)
- **Mammographie précoce dès 40 ans** (antécédent maternel cancer du sein <60 ans)
- Échographie ovarienne / dosage CA-125 (préventif annuel <50 ans avec ATCD)

## Questions à discuter

- Augmentation Lévothyroxine 75 → 87.5 µg si symptômes fatigue + brouillard mental persistent
- Test BRCA1/BRCA2 (consultation génétique recommandée)
- Optimisation supplémentation fer (forme bisglycinate vs sulfate, timing vs vit C)

---

# Pour mon naturopathe

## Profil ADN actionnable

- **APOE ε2 carrier** (rs7412): protection cardio + longévité
- **MTHFR A1298C hétérozygote**: privilégier folate méthylé (5-MTHF) plutôt qu'acide folique
- **VDR FokI hétérozygote**: surveiller niveaux 25(OH)D
- **LCT lactase non-persistante** (rs4988235 GG): éviter lactose ou choisir laits sans lactose
- **CYP1A2 métaboliseur rapide caféine**: max 2 cafés, pas après 14h

## Stack actuel

- Magnésium glycinate 400mg soir (depuis 6 mois)
- Vitamine D3 2000 UI matin (depuis 1 an)
- Oméga-3 EPA/DHA 1g matin (depuis 1 an)
- Probiotiques 10 souches (depuis 3 mois)
- Fer bisglycinate 25mg soir (à initier post-bilan)

## Mode de vie

- Activité: modérée 4-6h/sem (course + yoga)
- Sommeil: 7-8h/nuit, qualité bonne, régulier
- Alimentation: méditerranéenne, IF 14h
- Stress: 6/10 (travail freelance), méditation hebdo
- Pas de tabac, alcool 3-5 verres/sem

---

# Suivi mensuel

## Tendances biomarqueurs (60 jours)

- LDL: 1.05 → 1.02 g/L (stable, optimal)
- HDL: 0.62 → 0.65 g/L (légère hausse, bon)
- Triglycérides: 0.78 → 0.81 g/L (stable, optimal)
- HbA1c: 5.1% (stable)
- TSH: 1.2 mUI/L (stable)
- Ferritine: 28 → 24 ng/mL (**baisse à corriger**)

## Adhérence supplémentation: 78%

## Symptômes flaggés

- Fatigue (chronique)
- Ballonnements (occasionnel)
- Baisse libido (depuis 6 mois)
- Douleurs articulaires (cou/dos chronique)`;

sqlite(`INSERT INTO report (kind, title, body, meta, created_at, user_id) VALUES (${q("doctor-pack")}, ${q("Doctor Pack — " + new Date().toISOString().slice(0, 10))}, ${q(doctorPackBody)}, ${q(JSON.stringify({ status: "ready" }))}, ${Date.now()}, ${USER_ID})`);
console.log("✓ Inserted sample Doctor Pack");

// ───────────────────────────────────────────────────────────────
// Final report
// ───────────────────────────────────────────────────────────────
console.log("\n=== Demo enriched ===");
const final = sqlite(`SELECT
  (SELECT COUNT(*) FROM biomarker WHERE user_id = ${USER_ID}) as bms,
  (SELECT COUNT(*) FROM dna_insight WHERE user_id = ${USER_ID}) as dna,
  (SELECT COUNT(*) FROM supplement_log WHERE supplement_id IN (SELECT id FROM supplement WHERE user_id = ${USER_ID})) as suplogs,
  (SELECT COUNT(*) FROM habit_log WHERE user_id = ${USER_ID}) as habits,
  (SELECT COUNT(*) FROM note WHERE user_id = ${USER_ID}) as notes,
  (SELECT COUNT(*) FROM report WHERE user_id = ${USER_ID}) as reports`);
console.log(final);
console.log("\nLogin: demo@vitals.app / via /login?demo=1");
