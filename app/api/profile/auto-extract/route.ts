import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { decryptProfile } from "@/lib/crypto-fields";
import { anonymizeProfile } from "@/lib/anonymize";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CTX = 50000;
const MODEL = "claude-sonnet-4-5-20250929";

const SCHEMA_DESC = `{
  // === Identité ===
  firstName, lastName, email, phone, birthDate (YYYY-MM-DD), birthPlace, sex (Homme|Femme|Intersexe), ethnicity,

  // === Anthropométrie ===
  height (cm), weight (kg), bodyFat (%), bloodType (O+/A-/...),

  // === Médical libre ===
  chronicConditions, surgeries, hospitalizations, allergies, medications, supplements, vaccinations,
  fatherHealth, motherHealth, grandparentsHealth, siblingsHealth,
  familyDiseases (string[] court),

  // === ★ Famille structurée ★ — utilise CECI plutôt que les textareas si tu peux identifier des relatives précis ===
  // familyHistory: clé "{relativeKey}.{diseaseId}" → { status: "yes"|"no"|"unknown", ageOfDiagnosis?: number }
  // relativeKey ∈ father, mother, paternalGrandfather, paternalGrandmother, maternalGrandfather, maternalGrandmother, siblings, children, paternalUncleAunt, maternalUncleAunt
  // diseaseId ∈ mi, stroke, htn, afib, aneurysm, sudden_death, hf, t1d, t2d, obesity, fh_chol, metsyn, thyroid_hypo, hashimoto,
  //              cancer_breast, cancer_prostate, cancer_colon, cancer_lung, cancer_pancreas, cancer_ovary, cancer_uterus, melanoma, leukemia, cancer_other,
  //              alzheimer, parkinson, ms, als, dementia_other, huntington, epilepsy,
  //              crohn, uc, lupus, ra, psoriasis, celiac,
  //              depression, bipolar, schizo, suicide, addiction,
  //              thrombosis, hemophilia, sickle, ckd, pkd, cirrhosis, hemochromatosis,
  //              amd, glaucoma, deafness, osteoporosis, hip_fracture
  // Exemple: { "father.t2d": { "status": "yes", "ageOfDiagnosis": 58 }, "mother.cancer_breast": { "status": "yes" } }
  familyHistory: {},

  // === Symptômes actifs (array d'IDs) ===
  // IDs valides: fatigue, weight_change, night_sweats, fever_recurrent, palpitations, chest_pain, shortness_breath, edema,
  // headaches, dizziness, tingling, memory_loss, brain_fog, tremor, bloating, reflux, constipation, diarrhea, blood_stool, nausea,
  // joint_pain, back_pain, muscle_weakness, morning_stiffness, rash, hair_loss, new_mole, cough, snoring, urination_freq,
  // low_libido, erectile, anxiety, low_mood, insomnia, irritability, thirst, cold_sensitivity, heat_sensitivity
  activeSymptoms: ["..."],

  // === Suivi médical (dates des derniers examens) ===
  // screeningHistory: clé = id de l'examen, valeur = { lastDate: "YYYY-MM-DD" }
  // ids: checkup, blood_panel, dental, vision, hearing, skin_check, ecg, echo_heart, stress_test, colonoscopy, fobt, dexa,
  //      abdo_us, pap_smear, mammography, gyneco, hpv_test, psa, testicular, tetanus, flu, covid, shingles, pneumo
  screeningHistory: {},

  // === Femme (si applicable) ===
  cycleStatus, menarcheAge (number), cycleLength (number), pregnanciesG, pregnanciesP, miscarriages, menopauseStatus, menopauseAge,
  contraceptionType, hrtFemale (yes|no|unknown), lastPap, lastMammo,

  // === Homme (si applicable) ===
  trtMale (yes|no|unknown), vasectomy (yes|no|unknown), lastPsa, lastProstateExam,

  // === Lifestyle / sommeil / digestion ===
  dietType, smoker, alcoholDrinksWeek, tobaccoPackYears (number),
  lastColonoscopy, ibsSuspected (yes|no|unknown), lactoseSensitivity (yes|no|unknown), glutenSensitivity (yes|no|unknown),

  // === Praticiens & lieu ===
  primaryDoctor, specialists, preferredLab,
  currentLocation: { countryCode, city, region }, residenceHistory: [...],
  occupation, workEnvironment,

  // === Notes libres ===
  notes (faits utiles au médecin, non-redondants avec _memories)
}`;

const SYSTEM = `Tu es un médecin lecteur de dossier médical. Tu extrais d'un dossier patient brut (PDFs, notes, biomarkers, ADN, rapports antérieurs) UN UNIQUE objet JSON correspondant au schema de profile fourni. Tu ne fabriques JAMAIS d'info — si pas dans les docs, omets le champ. Aucune supposition ; uniquement des faits explicites dans le dossier.

Schéma cible (clés disponibles, à remplir uniquement si présent dans les docs) :
${SCHEMA_DESC}

Retourne ALSO une clé spéciale "_memories" : un tableau de strings courtes (1 phrase chacune) listant les FAITS MÉDICAUX importants détectés dans le dossier (ex: "Cholécystectomie en 2018", "Allergie à la pénicilline", "Hypertension diagnostiquée 2020", "Fracture du tibia 2015"). Max 25 entrées. Évite les redites.

Format réponse : UNIQUEMENT du JSON valide, pas de markdown, pas de prose, pas de fence \`\`\`. Si rien à extraire pour un champ, omets-le.`;

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const apiKey = anthropicApiKey();
  if (!apiKey) return NextResponse.json({ error: "Clé Anthropic manquante" }, { status: 500 });

  const sqlite = db().$client;

  // 1. existing profile (this user only) — via Convex
  const { data: profileStored } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const profileData = profileStored ? JSON.parse(profileStored) : {};
  // Anonymized for LLM context — the actual values from profile are not what we
  // need here (we're extracting NEW facts from documents into profile).
  const existing = anonymizeProfile(decryptProfile(profileData as Record<string, unknown>));

  // 2. documents (PDFs)
  const docs = sqlite
    .prepare(`SELECT id, title, category, date, text_content as textContent FROM document WHERE user_id = ? ORDER BY date DESC LIMIT 60`)
    .all(userId) as Array<{ id: number; title: string | null; category: string; date: number | null; textContent: string | null }>;

  // 3. rag chunks scoped via the parent document → user_id (rag_chunk has no direct user_id).
  const chunks = sqlite
    .prepare(`SELECT rc.text FROM rag_chunk rc JOIN document d ON d.id = rc.doc_id WHERE d.user_id = ? LIMIT 80`)
    .all(userId) as Array<{ text: string }>;

  // 4. dna insights (this user)
  const dnaIns = sqlite
    .prepare(`SELECT category, trait, summary, has_risk as hasRisk, user_genotype as userGenotype FROM dna_insight WHERE user_id = ? LIMIT 150`)
    .all(userId) as Array<{ category: string; trait: string; summary: string | null; hasRisk: number | null; userGenotype: string | null }>;

  // 5. biomarker history (unique slugs with most recent value)
  const biomarkers = sqlite.prepare(`
    SELECT name, slug, value, unit, ref_low as refLow, ref_high as refHigh, date
    FROM biomarker
    WHERE user_id = ?
    ORDER BY date DESC
    LIMIT 200
  `).all(userId) as Array<Record<string, unknown>>;

  // 6. recent reports — via Convex (self scope), latest 8.
  const { rows: reportRows } = await convexServer().query(api.reports.list, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const reports = reportRows
    .slice(0, 8)
    .map((r) => ({ kind: r.kind, title: r.title, body: r.body, createdAt: r.createdAt }));

  // Build mega-context with budget
  const parts: string[] = [];
  let used = 0;

  function push(label: string, content: string) {
    if (!content) return;
    const remaining = MAX_CTX - used;
    if (remaining < 200) return;
    const section = `\n\n=== ${label} ===\n${content.slice(0, remaining - label.length - 12)}`;
    parts.push(section);
    used += section.length;
  }

  // Reports first (high signal density)
  if (reports.length) {
    const txt = reports.map((r) => `# ${r.title} (${r.kind})\n${(r.body || "").slice(0, 4000)}`).join("\n\n---\n\n");
    push("RAPPORTS GÉNÉRÉS", txt);
  }

  // Documents
  if (docs.length) {
    const txt = docs.map((doc) => {
      const dt = doc.date ? new Date(doc.date as number).toISOString().slice(0, 10) : "?";
      const body = (doc.textContent || "").slice(0, 3500);
      return `# [${dt}] ${doc.title || "Sans titre"} (${doc.category})\n${body}`;
    }).join("\n\n---\n\n");
    push("DOCUMENTS PDF", txt);
  }

  // Biomarkers — keep only most recent per slug
  if (biomarkers.length) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const b of biomarkers) {
      const slug = String(b.slug);
      if (seen.has(slug)) continue;
      seen.add(slug);
      const dt = b.date ? new Date(Number(b.date)).toISOString().slice(0, 10) : "?";
      const ref = (b.refLow != null || b.refHigh != null) ? ` (ref ${b.refLow ?? "?"}-${b.refHigh ?? "?"})` : "";
      lines.push(`${dt} ${b.name}: ${b.value} ${b.unit || ""}${ref}`);
    }
    push("BIOMARQUEURS RÉCENTS (1 par type)", lines.join("\n"));
  }

  // DNA insights — only those with risk
  if (dnaIns.length) {
    const risky = dnaIns.filter((x) => x.hasRisk);
    const txt = risky.slice(0, 80).map((i) =>
      `[${i.category}] ${i.trait} (génotype: ${i.userGenotype || "?"}) — ${i.summary || ""}`
    ).join("\n");
    push("INSIGHTS ADN À RISQUE", txt);
  }

  // Extra rag chunks (medical terminology found there)
  if (chunks.length && used < MAX_CTX - 5000) {
    const txt = chunks.map((c) => c.text.slice(0, 800)).join("\n---\n");
    push("EXTRAITS RAG SUPPLÉMENTAIRES", txt);
  }

  const megaContext = parts.join("");
  if (megaContext.length < 200) {
    return NextResponse.json({ error: "Pas assez de données dans la base pour extraire" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const userMsg = `PROFILE EXISTANT (à enrichir, ne propose que des champs nouveaux ou plus précis):
${JSON.stringify(existing, null, 2)}

DOSSIER PATIENT BRUT (${megaContext.length} chars):
${megaContext}

Tâche: extrait un objet JSON correspondant au schema, en t'appuyant uniquement sur le dossier ci-dessus. Inclus aussi la clé _memories.`;

  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4500,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
  } catch (e) {
    return NextResponse.json({ error: "Anthropic error: " + (e as Error).message }, { status: 500 });
  }

  const content = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Pas de JSON détecté", raw: content.slice(0, 1000) }, { status: 500 });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return NextResponse.json({ error: "JSON invalide", raw: content.slice(0, 1000), detail: (e as Error).message }, { status: 500 });
  }

  const memories = Array.isArray(parsed._memories) ? (parsed._memories as unknown[]).filter((x) => typeof x === "string") as string[] : [];
  delete parsed._memories;

  return NextResponse.json({
    extracted: parsed,
    existing,
    memories,
    stats: {
      docs: docs.length,
      ragChunks: chunks.length,
      biomarkers: biomarkers.length,
      dnaInsights: dnaIns.length,
      reports: reports.length,
      contextChars: megaContext.length,
    },
  });
}
