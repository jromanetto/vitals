#!/usr/bin/env node
// Seed a fictional demo patient (Marie Dupont, 38 ans, F).
// Idempotent: deletes all rows where user_id=999 first, then inserts.
// Usage: node scripts/seed_demo.mjs
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import path from "node:path";

const DB_PATH = process.env.VITALS_DB_PATH || path.join(process.cwd(), "data", "vitals.db");
const USER_ID = 999;
const DEMO_EMAIL = "demo@vitals.app";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ──────────────────────────────────────────────────────────────────
// 1) Wipe all demo data
// ──────────────────────────────────────────────────────────────────
const tablesWithUserId = [
  "profile", "biomarker", "dna_variant", "dna_insight",
  "document", "rag_chunk", "rag_keyword", "note", "report",
  "ingest_log", "chat_session", "chat_message", "chat_memory",
  "supplement", "supplement_log", "symptom_log", "habit_log",
  "wearable_metric", "audit", "blood_report", "reminder",
];
const tx = db.transaction(() => {
  for (const t of tablesWithUserId) {
    try { db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(USER_ID); } catch {}
  }
  db.prepare(`DELETE FROM user WHERE id = ?`).run(USER_ID);
});
tx();

// ──────────────────────────────────────────────────────────────────
// 2) Insert demo user
// ──────────────────────────────────────────────────────────────────
const randomPwd = crypto.randomBytes(32).toString("base64url");
const hash = bcrypt.hashSync(randomPwd, 10);
const secret = crypto.randomBytes(48).toString("base64url");
db.prepare(`INSERT INTO user (id, email, hash, secret, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
  .run(USER_ID, DEMO_EMAIL, hash, secret, "demo", Date.now());

// ──────────────────────────────────────────────────────────────────
// 3) Profile: Marie Dupont, 38 ans, F
// ──────────────────────────────────────────────────────────────────
const profileData = {
  firstName: "Marie",
  lastName: "Dupont",
  birthDate: "1987-06-12",
  sex: "female",
  heightCm: 165,
  weightKg: 62,
  bloodType: "A+",
  city: "Lyon",
  country: "France",
  activityLevel: "moderate",
  diet: "omnivore",
  smoker: false,
  alcohol: "social",
  chronicConditions: [],
  allergies: ["pollen"],
  familyHistory: ["mère: hypothyroïdie", "grand-père paternel: AVC à 78 ans"],
  goals: ["énergie", "longévité", "préparation grossesse à moyen terme"],
  doctor: "Dr Lefèvre (médecin généraliste)",
  notes: "Patient fictif - mode démo Vitals.",
};
db.prepare(`INSERT INTO profile (data, updated_at, user_id) VALUES (?, ?, ?)`)
  .run(JSON.stringify(profileData), Date.now(), USER_ID);

// ──────────────────────────────────────────────────────────────────
// 4) Biomarkers — 50 across 4 panel dates
// ──────────────────────────────────────────────────────────────────
const PANEL_DATES = [
  new Date("2024-01-15").getTime(),
  new Date("2024-07-08").getTime(),
  new Date("2025-01-20").getTime(),
  new Date("2025-08-12").getTime(),
];

// 13 biomarkers per panel × 4 = 52 entries (~50)
function jitter(base, pct = 0.06) {
  const r = (Math.random() - 0.5) * 2 * pct;
  return Math.round(base * (1 + r) * 100) / 100;
}

const biomarkerTemplates = [
  // Lipides
  { name: "Cholestérol total", slug: "total_cholesterol", category: "lipides", base: 195, unit: "mg/dL", refLow: 0, refHigh: 200 },
  { name: "LDL Cholestérol", slug: "ldl_cholesterol", category: "lipides", base: 115, unit: "mg/dL", refLow: 0, refHigh: 100 },
  { name: "HDL Cholestérol", slug: "hdl_cholesterol", category: "lipides", base: 62, unit: "mg/dL", refLow: 50, refHigh: 100 },
  { name: "Triglycérides", slug: "triglycerides", category: "lipides", base: 88, unit: "mg/dL", refLow: 0, refHigh: 150 },
  // Glucose
  { name: "Glycémie à jeun", slug: "glucose_fasting", category: "glucose", base: 88, unit: "mg/dL", refLow: 70, refHigh: 100 },
  { name: "HbA1c", slug: "hba1c", category: "glucose", base: 5.3, unit: "%", refLow: 0, refHigh: 5.7 },
  // Thyroid
  { name: "TSH", slug: "tsh", category: "thyroïde", base: 2.1, unit: "mUI/L", refLow: 0.4, refHigh: 4.0 },
  { name: "T4 libre", slug: "t4_free", category: "thyroïde", base: 14.5, unit: "pmol/L", refLow: 9, refHigh: 20 },
  // Iron / B vitamins
  { name: "Ferritine", slug: "ferritin", category: "fer", base: 30, unit: "ng/mL", refLow: 30, refHigh: 200 },
  { name: "Vitamine D 25-OH", slug: "vitamin_d_25oh", category: "vitamines", base: 22, unit: "ng/mL", refLow: 30, refHigh: 100 },
  { name: "Vitamine B12", slug: "vitamin_b12", category: "vitamines", base: 320, unit: "pg/mL", refLow: 200, refHigh: 900 },
  // Inflammation
  { name: "hs-CRP", slug: "hscrp", category: "inflammation", base: 2.1, unit: "mg/L", refLow: 0, refHigh: 1.0 },
  // Hormones
  { name: "Œstradiol", slug: "estradiol", category: "hormones", base: 145, unit: "pg/mL", refLow: 30, refHigh: 400 },
];

const biomarkerStmt = db.prepare(`INSERT INTO biomarker (name, slug, category, value, unit, ref_low, ref_high, date, source, raw_text, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let biomarkerCount = 0;
for (const date of PANEL_DATES) {
  for (const t of biomarkerTemplates) {
    const v = jitter(t.base, 0.07);
    biomarkerStmt.run(t.name, t.slug, t.category, v, t.unit, t.refLow, t.refHigh, date, "Bilan biologique", null, USER_ID);
    biomarkerCount++;
  }
}

// ──────────────────────────────────────────────────────────────────
// 5) DNA insights — 30 entries with mix of has_risk / is_protective
// ──────────────────────────────────────────────────────────────────
const dnaInsights = [
  { rsid: "rs1801133", category: "methylation", trait: "MTHFR C677T", effect: "Activité réduite de la MTHFR", magnitude: 2.5, riskAllele: "T", userGenotype: "CT", hasRisk: 1, isProtective: 0, summary: "Hétérozygote MTHFR — légère baisse de méthylation. Surveiller homocystéine." },
  { rsid: "rs1801131", category: "methylation", trait: "MTHFR A1298C", effect: "Variant méthylation secondaire", magnitude: 1.8, riskAllele: "C", userGenotype: "AC", hasRisk: 1, isProtective: 0, summary: "Hétérozygote A1298C — impact modéré." },
  { rsid: "rs4680", category: "neuro", trait: "COMT Val158Met", effect: "Dégradation dopamine plus lente", magnitude: 2.0, riskAllele: "A", userGenotype: "GA", hasRisk: 0, isProtective: 0, summary: "Hétérozygote (worrier-warrior) — équilibre." },
  { rsid: "rs429358", category: "longevity", trait: "APOE ε4", effect: "Risque Alzheimer", magnitude: 3.5, riskAllele: "C", userGenotype: "TT", hasRisk: 0, isProtective: 1, summary: "Pas de variant ε4 — risque baseline." },
  { rsid: "rs7412", category: "longevity", trait: "APOE ε2", effect: "Variant APOE protecteur", magnitude: 2.0, riskAllele: "T", userGenotype: "CT", hasRisk: 0, isProtective: 1, summary: "Porteuse ε2 — protection lipidique." },
  { rsid: "rs53576", category: "neuro", trait: "OXTR (empathie)", effect: "Récepteur ocytocine", magnitude: 1.5, riskAllele: "A", userGenotype: "GG", hasRisk: 0, isProtective: 1, summary: "Profil GG — meilleure régulation sociale." },
  { rsid: "rs1799752", category: "performance", trait: "ACE I/D (endurance)", effect: "Endurance vs puissance", magnitude: 1.7, riskAllele: "D", userGenotype: "II", hasRisk: 0, isProtective: 1, summary: "Profil endurance favorable." },
  { rsid: "rs1815739", category: "performance", trait: "ACTN3 R577X", effect: "Fibres rapides", magnitude: 2.0, riskAllele: "T", userGenotype: "CT", hasRisk: 0, isProtective: 0, summary: "Mix endurance/puissance." },
  { rsid: "rs9939609", category: "metabolism", trait: "FTO (obésité)", effect: "Légère prédisposition prise de poids", magnitude: 1.8, riskAllele: "A", userGenotype: "AT", hasRisk: 1, isProtective: 0, summary: "Hétérozygote FTO — vigilance calorique." },
  { rsid: "rs7903146", category: "metabolism", trait: "TCF7L2 (diabète T2)", effect: "Risque diabète type 2", magnitude: 2.2, riskAllele: "T", userGenotype: "CC", hasRisk: 0, isProtective: 1, summary: "CC — risque baseline T2D." },
  { rsid: "rs662799", category: "lipides", trait: "APOA5", effect: "Triglycérides", magnitude: 1.6, riskAllele: "G", userGenotype: "AA", hasRisk: 0, isProtective: 1, summary: "Profil triglycérides favorable." },
  { rsid: "rs1799983", category: "cardio", trait: "NOS3 (endothélium)", effect: "Production NO endothéliale", magnitude: 1.9, riskAllele: "T", userGenotype: "GT", hasRisk: 1, isProtective: 0, summary: "Hétérozygote NOS3 — bénéfice betterave / arginine." },
  { rsid: "rs1042713", category: "cardio", trait: "ADRB2 (β-adrénergique)", effect: "Réponse adrénergique", magnitude: 1.4, riskAllele: "G", userGenotype: "AG", hasRisk: 0, isProtective: 0, summary: "Réponse adrénergique normale." },
  { rsid: "rs1800497", category: "neuro", trait: "DRD2 Taq1A", effect: "Récepteurs dopamine D2", magnitude: 1.7, riskAllele: "A", userGenotype: "GG", hasRisk: 0, isProtective: 1, summary: "GG — densité D2 favorable." },
  { rsid: "rs6265", category: "neuro", trait: "BDNF Val66Met", effect: "Plasticité cérébrale", magnitude: 1.8, riskAllele: "A", userGenotype: "GG", hasRisk: 0, isProtective: 1, summary: "Val/Val — BDNF optimal." },
  { rsid: "rs4994", category: "metabolism", trait: "ADRB3 (lipolyse)", effect: "Mobilisation graisses", magnitude: 1.3, riskAllele: "G", userGenotype: "AA", hasRisk: 0, isProtective: 1, summary: "Lipolyse favorable." },
  { rsid: "rs1801282", category: "metabolism", trait: "PPARG Pro12Ala", effect: "Sensibilité insuline", magnitude: 1.6, riskAllele: "G", userGenotype: "CG", hasRisk: 0, isProtective: 1, summary: "Variant Ala protecteur." },
  { rsid: "rs2228570", category: "vitamines", trait: "VDR FokI (vit D)", effect: "Récepteur vitamine D", magnitude: 1.5, riskAllele: "A", userGenotype: "AG", hasRisk: 1, isProtective: 0, summary: "Hétérozygote VDR — sensibilité moindre vit D." },
  { rsid: "rs1544410", category: "vitamines", trait: "VDR BsmI", effect: "Densité minérale osseuse", magnitude: 1.4, riskAllele: "G", userGenotype: "AG", hasRisk: 0, isProtective: 0, summary: "Profil osseux mixte." },
  { rsid: "rs6025", category: "cardio", trait: "Facteur V Leiden", effect: "Thrombophilie", magnitude: 3.0, riskAllele: "A", userGenotype: "GG", hasRisk: 0, isProtective: 1, summary: "Pas de variant Leiden — coagulation normale." },
  { rsid: "rs1799963", category: "cardio", trait: "Prothrombine G20210A", effect: "Coagulation", magnitude: 2.5, riskAllele: "A", userGenotype: "GG", hasRisk: 0, isProtective: 1, summary: "Profil coagulation baseline." },
  { rsid: "rs5882", category: "longevity", trait: "CETP I405V", effect: "HDL et longévité", magnitude: 1.7, riskAllele: "G", userGenotype: "AG", hasRisk: 0, isProtective: 1, summary: "Variant longévité partiel." },
  { rsid: "rs2802292", category: "longevity", trait: "FOXO3 (longévité)", effect: "Stress oxydatif", magnitude: 1.9, riskAllele: "G", userGenotype: "TT", hasRisk: 0, isProtective: 0, summary: "Pas de variant longévité FOXO3." },
  { rsid: "rs4988235", category: "nutrition", trait: "LCT (lactose)", effect: "Persistance lactase", magnitude: 2.2, riskAllele: "G", userGenotype: "GA", hasRisk: 0, isProtective: 1, summary: "Persistance lactase OK." },
  { rsid: "rs762551", category: "nutrition", trait: "CYP1A2 (caféine)", effect: "Métabolisme caféine", magnitude: 1.6, riskAllele: "C", userGenotype: "AC", hasRisk: 1, isProtective: 0, summary: "Métaboliseur lent — limiter café après 14h." },
  { rsid: "rs1229984", category: "nutrition", trait: "ADH1B (alcool)", effect: "Métabolisme alcool", magnitude: 1.8, riskAllele: "T", userGenotype: "CC", hasRisk: 0, isProtective: 0, summary: "Profil alcool standard." },
  { rsid: "rs17782313", category: "metabolism", trait: "MC4R (satiété)", effect: "Régulation appétit", magnitude: 1.5, riskAllele: "C", userGenotype: "TT", hasRisk: 0, isProtective: 1, summary: "Régulation satiété favorable." },
  { rsid: "rs1042522", category: "longevity", trait: "TP53 Pro72Arg", effect: "Apoptose / cancer", magnitude: 1.6, riskAllele: "C", userGenotype: "GG", hasRisk: 0, isProtective: 1, summary: "Profil TP53 favorable." },
  { rsid: "rs1800629", category: "inflammation", trait: "TNF-α -308G>A", effect: "Production TNF-α", magnitude: 1.7, riskAllele: "A", userGenotype: "GG", hasRisk: 0, isProtective: 1, summary: "Profil inflammatoire favorable." },
  { rsid: "rs1800795", category: "inflammation", trait: "IL-6 -174G>C", effect: "Inflammation chronique", magnitude: 1.5, riskAllele: "G", userGenotype: "GC", hasRisk: 0, isProtective: 0, summary: "Profil IL-6 hétérozygote." },
];

const dnaStmt = db.prepare(`INSERT INTO dna_insight (rsid, category, trait, effect, magnitude, risk_allele, user_genotype, has_risk, is_protective, summary, source, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const d of dnaInsights) {
  dnaStmt.run(d.rsid, d.category, d.trait, d.effect, d.magnitude, d.riskAllele, d.userGenotype, d.hasRisk, d.isProtective, d.summary, "demo-23andme", USER_ID);
}

// ──────────────────────────────────────────────────────────────────
// 6) Supplements — 5 actifs
// ──────────────────────────────────────────────────────────────────
const supplements = [
  { name: "Vitamine D3", dose: "2000", unit: "UI", timing: "matin", frequency: "daily", notes: "Cible 40-60 ng/mL. Vit D 25-OH actuelle: 22 ng/mL.", targetBiomarker: "vitamin_d_25oh" },
  { name: "Magnésium bisglycinate", dose: "300", unit: "mg", timing: "soir", frequency: "daily", notes: "Sommeil + crampes. Bisglycinate mieux toléré.", targetBiomarker: null },
  { name: "Oméga-3 EPA/DHA", dose: "1", unit: "g", timing: "midi", frequency: "daily", notes: "Triglycérides + inflammation. Cible EPA+DHA ≥1g.", targetBiomarker: "triglycerides" },
  { name: "Vitamine B12 méthylcobalamine", dose: "500", unit: "mcg", timing: "matin", frequency: "daily", notes: "B12 à 320 pg/mL — viser >500. Forme méthyl pour MTHFR CT.", targetBiomarker: "vitamin_b12", targetSnp: "rs1801133" },
  { name: "Probiotique multi-souches", dose: "1", unit: "gélule", timing: "matin", frequency: "daily", notes: "Soutien microbiote / immunité. 20 milliards CFU.", targetBiomarker: null },
];
const startedAt = Date.now() - 90 * 86400000;
const supStmt = db.prepare(`INSERT INTO supplement (name, dose, unit, timing, frequency, started_at, ended_at, notes, target_biomarker, target_snp, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const s of supplements) {
  supStmt.run(s.name, s.dose, s.unit, s.timing, s.frequency, startedAt, null, s.notes, s.targetBiomarker, s.targetSnp ?? null, USER_ID, Date.now());
}

// ──────────────────────────────────────────────────────────────────
// 7) Wearables — 60 days, HRV / RHR / sleep / recovery (Whoop-like)
// ──────────────────────────────────────────────────────────────────
const wearableStmt = db.prepare(`INSERT OR REPLACE INTO wearable_metric (date, source, kind, value, unit, user_id) VALUES (?, ?, ?, ?, ?, ?)`);
const today = new Date();
for (let i = 60; i >= 1; i--) {
  const d = new Date(today.getTime() - i * 86400000);
  const dateStr = d.toISOString().slice(0, 10);
  // Slight upward HRV trend over time (improving)
  const trend = (60 - i) / 60; // 0 → 1
  const hrvBase = 48 + trend * 8; // 48 → 56 ms
  const hrv = Math.round((hrvBase + (Math.random() - 0.5) * 8) * 10) / 10;
  const rhr = Math.round(58 - trend * 3 + (Math.random() - 0.5) * 4);
  const sleepTotal = Math.round(420 + (Math.random() - 0.5) * 60); // 7h ± 30 min, in min
  const sleepDeep = Math.round(80 + (Math.random() - 0.5) * 20);
  const sleepRem = Math.round(110 + (Math.random() - 0.5) * 25);
  const recovery = Math.min(99, Math.max(20, Math.round(60 + trend * 10 + (Math.random() - 0.5) * 25)));
  const strain = Math.round((10 + Math.random() * 6) * 10) / 10;
  const steps = Math.round(7000 + Math.random() * 6000);

  wearableStmt.run(dateStr, "whoop", "hrv", hrv, "ms", USER_ID);
  wearableStmt.run(dateStr, "whoop", "rhr", rhr, "bpm", USER_ID);
  wearableStmt.run(dateStr, "whoop", "sleep_total_min", sleepTotal, "min", USER_ID);
  wearableStmt.run(dateStr, "whoop", "sleep_deep_min", sleepDeep, "min", USER_ID);
  wearableStmt.run(dateStr, "whoop", "sleep_rem_min", sleepRem, "min", USER_ID);
  wearableStmt.run(dateStr, "whoop", "recovery", recovery, "score", USER_ID);
  wearableStmt.run(dateStr, "whoop", "strain", strain, "score", USER_ID);
  wearableStmt.run(dateStr, "whoop", "steps", steps, "steps", USER_ID);
}

// ──────────────────────────────────────────────────────────────────
// 8) Symptom logs — 10 entries over last 30 days
// ──────────────────────────────────────────────────────────────────
const symptomStmt = db.prepare(`INSERT OR REPLACE INTO symptom_log (date, key, value, notes, user_id) VALUES (?, ?, ?, ?, ?)`);
const symptomEntries = [
  { dayAgo: 28, key: "energy", value: 6, notes: "Lendemain de soirée." },
  { dayAgo: 25, key: "mood", value: 7, notes: null },
  { dayAgo: 22, key: "sleep_quality", value: 8, notes: "Bonne nuit, magnésium pris." },
  { dayAgo: 18, key: "energy", value: 7, notes: null },
  { dayAgo: 14, key: "mood", value: 8, notes: "Sport en extérieur." },
  { dayAgo: 11, key: "sleep_quality", value: 6, notes: "Réveil 3h." },
  { dayAgo: 8, key: "energy", value: 8, notes: null },
  { dayAgo: 5, key: "mood", value: 7, notes: null },
  { dayAgo: 3, key: "sleep_quality", value: 9, notes: "Excellente nuit." },
  { dayAgo: 1, key: "energy", value: 8, notes: null },
];
for (const s of symptomEntries) {
  const d = new Date(today.getTime() - s.dayAgo * 86400000).toISOString().slice(0, 10);
  symptomStmt.run(d, s.key, s.value, s.notes, USER_ID);
}

// ──────────────────────────────────────────────────────────────────
// 9) Chat sessions — 3 sample sessions
// ──────────────────────────────────────────────────────────────────
const chatSessionStmt = db.prepare(`INSERT INTO chat_session (title, created_at, updated_at, user_id) VALUES (?, ?, ?, ?)`);
const chatMsgStmt = db.prepare(`INSERT INTO chat_message (session_id, role, content, sources, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)`);

const sessions = [
  {
    title: "Ma vitamine D est trop basse",
    daysAgo: 20,
    messages: [
      { role: "user", content: "Pourquoi ma vitamine D est à 22 ng/mL ? Est-ce grave ?" },
      { role: "assistant", content: "Marie, ta vitamine D 25-OH est à 22 ng/mL alors que la cible optimale est 40-60 ng/mL. C'est un déficit léger, fréquent en France l'hiver. Pas grave en aigu, mais à corriger : la vitamine D régule l'absorption du calcium, l'immunité, et l'humeur. Ta supplémentation actuelle (D3 2000 UI/jour) est bien dosée — recheck dans 3 mois pour confirmer la remontée." },
    ],
  },
  {
    title: "MTHFR : que faire ?",
    daysAgo: 12,
    messages: [
      { role: "user", content: "J'ai vu que j'étais hétérozygote MTHFR C677T. Qu'est-ce que ça veut dire concrètement ?" },
      { role: "assistant", content: "Tu es CT (un seul allèle muté), ce qui réduit l'activité de l'enzyme MTHFR de ~30%. Concrètement : ta capacité à transformer le folate en sa forme active (méthylfolate) est légèrement diminuée. Recommandations : 1) prendre B12 sous forme méthylcobalamine (ce que tu fais déjà ✓), 2) folates alimentaires (légumes verts, lentilles), 3) surveiller l'homocystéine au prochain bilan. Pas besoin de panique : C677T hétérozygote concerne ~40% de la population." },
    ],
  },
  {
    title: "HRV en hausse — bon signe ?",
    daysAgo: 5,
    messages: [
      { role: "user", content: "Ma HRV moyenne est passée de 48 à 55 ms en 2 mois. C'est bon signe ?" },
      { role: "assistant", content: "Oui, excellent signe ! Une HRV qui monte indique un meilleur tonus parasympathique : moins de stress, meilleure récupération, système cardiovasculaire plus adaptatif. Ça correspond probablement à : sommeil plus régulier (tu es à ~7h en moyenne), magnésium en place, peut-être moins d'alcool. Continue. Note : la HRV varie de 5-15% jour à jour — regarde la moyenne mobile sur 7 jours pour suivre la tendance réelle." },
    ],
  },
];

for (const sess of sessions) {
  const t = today.getTime() - sess.daysAgo * 86400000;
  const r = chatSessionStmt.run(sess.title, t, t + 1000, USER_ID);
  const sid = Number(r.lastInsertRowid);
  let ts = t;
  for (const m of sess.messages) {
    chatMsgStmt.run(sid, m.role, m.content, null, ts, USER_ID);
    ts += 1500;
  }
}

// ──────────────────────────────────────────────────────────────────
// 10) Reminders — 2 entries
// ──────────────────────────────────────────────────────────────────
const reminderStmt = db.prepare(`INSERT INTO reminder (title, description, due_at, category, done, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
reminderStmt.run(
  "RDV gynécologue annuel",
  "Frottis + bilan hormonal complet. Évoquer le projet grossesse à moyen terme.",
  Date.now() + 60 * 86400000,
  "rdv-medical",
  0,
  USER_ID,
  Date.now(),
);
reminderStmt.run(
  "Recheck Vitamine B12",
  "Refaire un dosage B12 + homocystéine après 8 semaines de méthylcobalamine 500 mcg.",
  Date.now() + 56 * 86400000,
  "biomarqueur",
  0,
  USER_ID,
  Date.now(),
);

// ──────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────
const counts = {
  user: db.prepare(`SELECT COUNT(*) as n FROM user WHERE id = ?`).get(USER_ID).n,
  profile: db.prepare(`SELECT COUNT(*) as n FROM profile WHERE user_id = ?`).get(USER_ID).n,
  biomarker: db.prepare(`SELECT COUNT(*) as n FROM biomarker WHERE user_id = ?`).get(USER_ID).n,
  dna_insight: db.prepare(`SELECT COUNT(*) as n FROM dna_insight WHERE user_id = ?`).get(USER_ID).n,
  supplement: db.prepare(`SELECT COUNT(*) as n FROM supplement WHERE user_id = ?`).get(USER_ID).n,
  wearable_metric: db.prepare(`SELECT COUNT(*) as n FROM wearable_metric WHERE user_id = ?`).get(USER_ID).n,
  symptom_log: db.prepare(`SELECT COUNT(*) as n FROM symptom_log WHERE user_id = ?`).get(USER_ID).n,
  chat_session: db.prepare(`SELECT COUNT(*) as n FROM chat_session WHERE user_id = ?`).get(USER_ID).n,
  chat_message: db.prepare(`SELECT COUNT(*) as n FROM chat_message WHERE user_id = ?`).get(USER_ID).n,
  reminder: db.prepare(`SELECT COUNT(*) as n FROM reminder WHERE user_id = ?`).get(USER_ID).n,
};

console.log("Demo seed complete (Marie Dupont, user_id=999, email=demo@vitals.app):");
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(18)} ${v}`);
}
db.close();
