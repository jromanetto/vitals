#!/usr/bin/env node
/**
 * Doctor Pack: PDF-friendly markdown report bundling
 * - Patient profile summary
 * - Latest bilan (top 30 biomarkers)
 * - 5-year trends on key markers
 * - DNA highlights (top risks)
 * - Current supplements
 * - Recent symptoms summary (7 days)
 * - 5 questions à poser au médecin
 */
import Database from "better-sqlite3";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const reportId = parseInt(process.argv[2], 10);
const auth = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "auth.json"), "utf8"));
const apiKey = auth.anthropicApiKey;
const db = new Database(path.join(process.cwd(), "data", "vitals.db"));
// Scope every read to the report's owner so a beta user never gets the owner's data.
const ownerRow = db.prepare(`SELECT user_id FROM report WHERE id = ?`).get(reportId);
const userId = ownerRow?.user_id ?? 1;

(async () => {
  let body;
  try {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    const profile = (db.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId))?.data;
    const profileObj = profile ? JSON.parse(profile) : {};

    const bms = db.prepare(`
      SELECT b.name, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date
      FROM biomarker b
      JOIN (SELECT slug, MAX(date) AS md FROM biomarker WHERE user_id = ? GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date
      WHERE b.user_id = ?
      ORDER BY name
    `).all(userId, userId);

    // Trends: for each biomarker with >2 measurements, compute first vs last
    const trendable = db.prepare(`SELECT slug, COUNT(*) c FROM biomarker WHERE user_id = ? GROUP BY slug HAVING c >= 2`).all(userId);
    const trends = [];
    for (const t of trendable) {
      const points = db.prepare(`SELECT name, value, date FROM biomarker WHERE slug = ? AND user_id = ? ORDER BY date ASC`).all(t.slug, userId);
      const first = points[0], last = points[points.length - 1];
      const change = ((last.value - first.value) / first.value) * 100;
      if (Math.abs(change) > 10) {
        trends.push({ name: first.name, first: first.value, last: last.value, change: change.toFixed(1), n: points.length, span: `${new Date(first.date).getFullYear()}-${new Date(last.date).getFullYear()}` });
      }
    }

    const dnaRisks = db.prepare(`SELECT trait, user_genotype as ug, summary, magnitude, category FROM dna_insight WHERE user_id = ? AND has_risk = 1 ORDER BY COALESCE(magnitude, 1) DESC LIMIT 12`).all(userId);

    const supplements = db.prepare(`SELECT name, dose, timing, frequency FROM supplement WHERE user_id = ? AND ended_at IS NULL ORDER BY name`).all(userId);
    const symptomsRecent = db.prepare(`SELECT key, AVG(value) avg, COUNT(*) n FROM symptom_log WHERE user_id = ? AND date >= ? GROUP BY key`).all(
      userId,
      new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    );

    const client = new Anthropic({ apiKey });
    const sys = "Tu es un médecin biologiste qui prépare un dossier patient pour son rendez-vous médical. Ton rapport doit être lisible par un médecin pressé en 2-3 minutes. Markdown, tableaux quand pertinent, factuel, sans bavardage.";
    const prompt = `Prépare un Doctor Pack pour le rendez-vous médical.

PATIENT:
${profileObj.firstName ?? ""} ${profileObj.lastName ?? ""}, ${profileObj.birthDate ? `né(e) le ${profileObj.birthDate}` : ""}, ${profileObj.sex ?? ""}.
Taille: ${profileObj.height ?? "?"} cm, Poids: ${profileObj.weight ?? "?"} kg.
Activité: ${profileObj.activityLevel ?? "?"}.
Pathologies: ${profileObj.chronicConditions ?? "Aucune"}.
Médicaments: ${profileObj.medications ?? "Aucun"}.
Allergies: ${profileObj.allergies ?? "Aucune"}.
Antécédents familiaux: ${(Array.isArray(profileObj.familyDiseases) ? profileObj.familyDiseases.join(", ") : profileObj.familyDiseases) ?? ""}.
Objectifs: ${(Array.isArray(profileObj.primaryGoals) ? profileObj.primaryGoals.join(", ") : profileObj.primaryGoals) ?? ""}.

DERNIER BILAN (${bms.length} marqueurs):
${bms.map((b) => `- ${b.name}: ${b.value} ${b.unit ?? ""} (ref ${b.refLow ?? "?"}–${b.refHigh ?? "?"})`).join("\n")}

TENDANCES NOTABLES (>10% de variation, ${trends.length} marqueurs):
${trends.map((t) => `- ${t.name}: ${t.first} → ${t.last} (${t.change}% sur ${t.span}, ${t.n} mesures)`).join("\n")}

ADN — TOP RISQUES (${dnaRisks.length}):
${dnaRisks.map((d) => `- [${d.category}] ${d.trait} = ${d.ug}: ${d.summary}`).join("\n")}

SUPPLÉMENTS ACTUELS (${supplements.length}):
${supplements.map((s) => `- ${s.name}${s.dose ? ` ${s.dose}` : ""}${s.timing ? ` (${s.timing})` : ""}`).join("\n")}

SYMPTÔMES MOYENS 7 DERNIERS JOURS:
${symptomsRecent.map((s) => `- ${s.key}: ${s.avg.toFixed(1)}/10 (n=${s.n})`).join("\n")}

Structure attendue:
1. **Synthèse 3 lignes** (état général)
2. **Marqueurs hors range** (tableau: nom | valeur | range | direction)
3. **Tendances notables** (top 5 améliorations + top 5 régressions)
4. **Profil ADN pertinent pour le suivi clinique** (top 5 actionnable)
5. **Stack supplémentaire** (liste courte)
6. **5 questions à poser au médecin** (basées sur les données ci-dessus)
7. **Examens complémentaires suggérés** (ex: si LDL haut + Lp(a) jamais mesurée, suggérer Lp(a))

Sois concret, factuel, médecin-friendly.`;

    const resp = await client.messages.create({
      model: "claude-sonnet-4-5-20250929", max_tokens: 4000,
      system: sys, messages: [{ role: "user", content: prompt }],
    });
    body = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch (e) {
    body = `# Erreur\n\n${e.message}`;
  }
  db.prepare(`UPDATE report SET title = ?, body = ? WHERE id = ?`).run(`Doctor Pack — ${new Date().toLocaleDateString("fr-FR")}`, body, reportId);
  console.log(`[doctor-pack] id=${reportId} blen=${body.length}`);
  db.close();
})();
