#!/usr/bin/env node
/**
 * Standalone report generator. Called as detached child process from the API route.
 * Args: <reportId> <kind>
 * Reads data from data/vitals.db, calls Anthropic, writes body back to DB.
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

const db = new Database(path.join(process.cwd(), "data", "vitals.db"));
const profile = db.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).get();
const profileObj = profile ? JSON.parse(profile.data) : {};
const bms = db.prepare(`SELECT b.name, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date FROM biomarker b JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date`).all();
const dna = db.prepare(`SELECT trait, user_genotype as ug, has_risk as hasRisk, summary FROM dna_insight ORDER BY (has_risk * COALESCE(magnitude,1)) DESC`).all();

(async () => {
  let body;
  try {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
    const client = new Anthropic({ apiKey });
    const prompt = `Génère un rapport "${meta.title}" pour ce profil.\n\nPROFIL:\n\`\`\`json\n${JSON.stringify(profileObj)}\n\`\`\`\n\nBIOMARQUEURS (${bms.length}):\n${bms.map((b) => `- ${b.name}: ${b.value} ${b.unit ?? ""} (ref ${b.refLow ?? "?"}–${b.refHigh ?? "?"}) — ${new Date(b.date).toISOString().slice(0,10)}`).join("\n")}\n\nADN (${dna.length}):\n${dna.map((i) => `- ${i.trait} = ${i.ug}${i.hasRisk ? " ⚠" : ""}: ${i.summary}`).join("\n")}\n\nSections:\n${meta.sections}\n\nMarkdown. Concret, chiffré, pas de disclaimer.`;
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5-20250929", max_tokens: 4000,
      system: meta.sys, messages: [{ role: "user", content: prompt }],
    });
    body = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch (e) {
    body = `# Erreur\n\n${e.message}`;
  }
  db.prepare(`UPDATE report SET title = ?, body = ? WHERE id = ?`).run(`${meta.title} — ${new Date().toLocaleDateString("fr-FR")}`, body, reportId);
  console.log(`[gen-report] id=${reportId} kind=${kind} blen=${body.length}`);
  db.close();
})();
