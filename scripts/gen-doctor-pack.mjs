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
 *
 * Called as detached child process from the API route.
 * Args: <reportId> <userId>
 * Reads data from Convex (scoped to the owner userId passed by the route), calls
 * Anthropic, writes the body back to Convex via reports.updateReport.
 *
 * Env: NEXT_PUBLIC_CONVEX_URL + SERVER_BRIDGE_SECRET (from process.env, .env.local,
 * or data/auth.json {convexUrl, serverBridgeSecret}). Anthropic key from data/auth.json.
 */
import Anthropic from "@anthropic-ai/sdk";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { MODELS, THINKING } from "../lib/ai/models.mjs";

// Inline field decryption (mirrors lib/crypto-fields; worker runs via plain node).
function decryptProfileDeep(obj, keyB64) {
  if (!keyB64) return obj;
  const key = Buffer.from(keyB64, "base64");
  const dec = (v) => {
    if (typeof v === "string" && v.startsWith("enc:")) {
      try {
        const [iv, tag, ct] = v.slice(4).split(":");
        const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
        d.setAuthTag(Buffer.from(tag, "base64"));
        return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
      } catch { return v; }
    }
    if (Array.isArray(v)) return v.map(dec);
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = dec(x); return o; }
    return v;
  };
  return dec(obj);
}

const reportId = parseInt(process.argv[2], 10);
const userId = parseInt(process.argv[3], 10) || 1;

const ROOT = process.cwd();
function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const auth = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "auth.json"), "utf8"));
const apiKey = auth.anthropicApiKey;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || auth.convexUrl;
const secret = process.env.SERVER_BRIDGE_SECRET || auth.serverBridgeSecret;

(async () => {
  if (!convexUrl || !secret) throw new Error("NEXT_PUBLIC_CONVEX_URL / SERVER_BRIDGE_SECRET missing");
  const convex = new ConvexHttpClient(convexUrl);

  let body;
  try {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    // Profile (owner-scoped).
    const profRes = await convex.query(api.profile.get, { secret, authUserId: userId });
    const profileObj = decryptProfileDeep(profRes.data ? JSON.parse(profRes.data) : {}, auth.fieldEncryptionKey);

    // Biomarkers (owner-scoped). Group latest-per-slug + build per-slug trend series.
    const bioAll = (await convex.query(api.biomarkers.all, { secret, authUserId: userId })).rows;
    const maxDate = new Map();
    for (const r of bioAll) { const m = maxDate.get(r.slug); if (m == null || r.date > m) maxDate.set(r.slug, r.date); }
    const bms = bioAll
      .filter((r) => r.date === maxDate.get(r.slug))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Trends: for each biomarker with >=2 measurements, first vs last.
    const bySlug = new Map();
    for (const r of bioAll) { if (!bySlug.has(r.slug)) bySlug.set(r.slug, []); bySlug.get(r.slug).push(r); }
    const trends = [];
    for (const points of bySlug.values()) {
      if (points.length < 2) continue;
      points.sort((a, b) => a.date - b.date);
      const first = points[0], last = points[points.length - 1];
      const change = ((last.value - first.value) / first.value) * 100;
      if (Math.abs(change) > 10) {
        trends.push({ name: first.name, first: first.value, last: last.value, change: change.toFixed(1), n: points.length, span: `${new Date(first.date).getFullYear()}-${new Date(last.date).getFullYear()}` });
      }
    }

    // DNA — top risks (owner-scoped): has_risk, magnitude DESC, limit 12.
    const dnaAll = (await convex.query(api.dna.insights, { secret, authUserId: userId })).rows;
    const dnaRisks = dnaAll
      .filter((i) => i.hasRisk)
      .sort((a, b) => (b.magnitude ?? 1) - (a.magnitude ?? 1))
      .slice(0, 12)
      .map((i) => ({ trait: i.trait, ug: i.userGenotype, summary: i.summary, magnitude: i.magnitude, category: i.category }));

    // Supplements (owner-scoped): active = endedAt null, by name.
    const suppRes = await convex.query(api.supplements.list, { secret, authUserId: userId });
    const supplements = suppRes.rows
      .filter((s) => s.endedAt == null)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Symptoms — average over the last 7 days (owner-scoped).
    const symptomsRes = await convex.query(api.symptoms.list, { secret, authUserId: userId, days: 30 });
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const agg = new Map();
    for (const l of symptomsRes.rows) {
      if (l.date < cutoff) continue;
      const a = agg.get(l.key) || { sum: 0, n: 0 };
      a.sum += l.value; a.n += 1; agg.set(l.key, a);
    }
    const symptomsRecent = [...agg.entries()].map(([key, a]) => ({ key, avg: a.sum / a.n, n: a.n }));

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
      // max_tokens couvre thinking + markdown du pack. 16000 reste sous le
      // timeout HTTP du SDK en non-streaming.
      model: MODELS.REASONING, thinking: THINKING.REASONING, max_tokens: 16000,
      system: sys, messages: [{ role: "user", content: prompt }],
    });
    body = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch (e) {
    body = `# Erreur\n\n${e.message}`;
  }

  await convex.mutation(api.reports.updateReport, {
    secret, id: reportId,
    title: `Doctor Pack — ${new Date().toLocaleDateString("fr-FR")}`,
    body, status: "ready", meta: JSON.stringify({ status: "ready" }),
  });
  console.log(`[doctor-pack] id=${reportId} blen=${body.length}`);
})();
