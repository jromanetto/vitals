#!/usr/bin/env node
/**
 * Standalone report generator. Called as detached child process from the API route.
 * Args: <reportId> <kind>
 * Reads data from data/vitals.db, calls Anthropic, writes body back to DB.
 * Anonymizes PII before sending to LLM if anonymizeLLM toggle is on.
 */
import Database from "better-sqlite3";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const KIND_PROMPTS = {
  "overview": { title: "Vue d'ensemble santé", sys: "Tu es médecin de santé fonctionnelle. Markdown, factuel, personnalisé.", sections: "1. Synthèse exécutive\n2. Points forts\n3. Points à surveiller\n4. Corrélations\n5. 5 actions priorisées" },
  "cardiovascular": { title: "Santé cardiovasculaire", sys: "Tu es cardiologue préventionniste.", sections: "1. Score risque\n2. Lipides\n3. Inflammation\n4. ADN cardio\n5. 5 actions" },
  "metabolic": { title: "Santé métabolique", sys: "Tu es endocrinologue insulinorésistance.", sections: "1. Glycémie/HbA1c\n2. Lipides\n3. ADN (FTO, TCF7L2)\n4. Fer\n5. 5 actions" },
  "longevity": { title: "Longévité", sys: "Tu es spécialiste longévité (Peter Attia).", sections: "1. Profil ADN longévité\n2. Biomarkers longevity-tilted\n3. Inflammaging\n4. Top 5 leviers" },
  "nutrition": { title: "Nutrition personnalisée", sys: "Tu es nutritionniste fonctionnelle.", sections: "1. Nutrigénomique\n2. Méthylation\n3. Vitamines D/B12/fer\n4. Oméga-3\n5. 5 ajustements" },
  "cognition": { title: "Cognition", sys: "Tu es neurologue fonctionnel.", sections: "1. Profil (BDNF, COMT)\n2. APOE\n3. Neurotransmetteurs\n4. Recommandations" },
  "hormonal": { title: "Profil hormonal", sys: "Tu es endocrinologue hormones.", sections: "1. HPA\n2. Gonadotrope\n3. Thyroïde\n4. ADN hormonal\n5. Recommandations" },
  "inflammation": { title: "Inflammation", sys: "Tu es immunologue.", sections: "1. Marqueurs\n2. ADN pro-inflammatoire\n3. Recommandations" },
  "dna-deep-dive": { title: "Analyse ADN approfondie", sys: "Tu es généticien clinique.", sections: "Pour chaque catégorie: 2-3 SNPs majeurs + action." },
  "next-bloodwork-prep": { title: "Préparation prochaine prise de sang", sys: "Tu es médecin biologiste.", sections: "1. Marqueurs déjà suivis\n2. Manquants critiques\n3. Liste précise pour médecin\n4. Conditions" },
  "supplement-recommendations": { title: "Recommandations supplémentation", sys: "Tu es pharmacien nutrithérapie.", sections: "Pour chaque supplément: nom, dose, timing, durée, rationale, interactions." },
};

const reportId = parseInt(process.argv[2], 10);
const kind = process.argv[3] || "overview";
const meta = KIND_PROMPTS[kind] || KIND_PROMPTS.overview;

const auth = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "auth.json"), "utf8"));
const apiKey = auth.anthropicApiKey;
const anonymizeEnabled = auth.anonymizeLLM === undefined ? true : !!auth.anonymizeLLM;

const db = new Database(path.join(process.cwd(), "data", "vitals.db"));
const profile = db.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).get();
const profileObj = profile ? JSON.parse(profile.data) : {};
const bms = db.prepare(`SELECT b.name, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date FROM biomarker b JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date`).all();
const dna = db.prepare(`SELECT trait, user_genotype as ug, has_risk as hasRisk, summary FROM dna_insight ORDER BY (has_risk * COALESCE(magnitude,1)) DESC`).all();

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function anonymize(text) {
  if (!anonymizeEnabled || !text) return text;
  let out = text;
  const names = [];
  for (const k of ["firstName", "lastName", "first_name", "last_name", "name", "fullName"]) {
    const v = profileObj[k];
    if (typeof v === "string" && v.length >= 2) names.push(v);
  }
  for (const n of names) {
    out = out.replace(new RegExp(escRe(n), "gi"), "[USER]");
    for (const part of n.split(/\s+/)) {
      if (part.length >= 3) out = out.replace(new RegExp("\\b" + escRe(part) + "\\b", "gi"), "[USER]");
    }
  }
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  for (const k of ["city", "address", "town", "addressLine", "postalCode", "zipCode", "zip", "country"]) {
    const v = profileObj[k];
    if (typeof v === "string" && v.length >= 2) out = out.replace(new RegExp(escRe(v), "gi"), "[LOCATION]");
  }
  for (const k of ["phone", "phoneNumber", "tel"]) {
    const v = profileObj[k];
    if (typeof v === "string" && v.length >= 5) out = out.replace(new RegExp(escRe(v), "g"), "[PHONE]");
  }
  return out;
}

function anonymizeProfile(p) {
  if (!anonymizeEnabled) return p;
  const c = { ...p };
  for (const k of ["firstName", "lastName", "first_name", "last_name", "name", "fullName"]) if (c[k]) c[k] = "[USER]";
  for (const k of ["email"]) if (c[k]) c[k] = "[EMAIL]";
  for (const k of ["phone", "phoneNumber", "tel"]) if (c[k]) c[k] = "[PHONE]";
  for (const k of ["city", "address", "town", "addressLine", "postalCode", "zipCode", "zip", "country"]) if (c[k]) c[k] = "[LOCATION]";
  const dob = c.birthDate || c.dob || c.dateOfBirth;
  if (dob) {
    try {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400 * 1000));
        if (c.birthDate) c.birthDate = `[DOB age=${age}]`;
        if (c.dob) c.dob = `[DOB age=${age}]`;
        if (c.dateOfBirth) c.dateOfBirth = `[DOB age=${age}]`;
        c.age = age;
      }
    } catch {}
  }
  return c;
}

(async () => {
  let body;
  try {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
    const client = new Anthropic({ apiKey });
    const safeProfile = anonymizeProfile(profileObj);
    let prompt = `Génère un rapport "${meta.title}" pour ce profil.\n\nPROFIL:\n\`\`\`json\n${JSON.stringify(safeProfile)}\n\`\`\`\n\nBIOMARQUEURS (${bms.length}):\n${bms.map((b) => `- ${b.name}: ${b.value} ${b.unit ?? ""} (ref ${b.refLow ?? "?"}–${b.refHigh ?? "?"}) — ${new Date(b.date).toISOString().slice(0,10)}`).join("\n")}\n\nADN (${dna.length}):\n${dna.map((i) => `- ${i.trait} = ${i.ug}${i.hasRisk ? " ⚠" : ""}: ${i.summary}`).join("\n")}\n\nSections:\n${meta.sections}\n\nMarkdown. Concret, chiffré, pas de disclaimer.`;
    prompt = anonymize(prompt);
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5-20250929", max_tokens: 4000,
      system: meta.sys, messages: [{ role: "user", content: prompt }],
    });
    body = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch (e) {
    body = `# Erreur\n\n${e.message}`;
  }
  db.prepare(`UPDATE report SET title = ?, body = ? WHERE id = ?`).run(`${meta.title} — ${new Date().toLocaleDateString("fr-FR")}`, body, reportId);
  // Audit log
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, target TEXT, ip TEXT, user_agent TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`).run();
    db.prepare(`INSERT INTO audit (action, target) VALUES (?, ?)`).run("report_generated", `id=${reportId} kind=${kind} blen=${body.length}`);
  } catch {}
  console.log(`[gen-report] id=${reportId} kind=${kind} blen=${body.length} anon=${anonymizeEnabled}`);
  db.close();
})();
