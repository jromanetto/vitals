import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { decryptProfile } from "@/lib/crypto-fields";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/secrets";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CTX = 50000;
const MODEL = "claude-sonnet-4-5-20250929";

const SCHEMA_DESC = `{
  firstName, lastName, email, phone, birthDate (YYYY-MM-DD), birthPlace, sex (Homme|Femme|Intersexe), ethnicity,
  height (cm), weight (kg), bodyFat (%), bloodType (O+/A-/...),
  chronicConditions, surgeries, hospitalizations, allergies, medications, supplements, vaccinations,
  fatherHealth, motherHealth, grandparentsHealth, siblingsHealth,
  familyDiseases (string[]),
  primaryDoctor, specialists, preferredLab,
  currentLocation: { countryCode, city, region }, residenceHistory: [...],
  occupation, workEnvironment,
  dietType, smoker, alcoholDrinksWeek,
  notes (free notes utiles au médecin)
}`;

const SYSTEM = `Tu es un médecin lecteur de dossier médical. Tu extrais d'un dossier patient brut (PDFs, notes, biomarkers, ADN, rapports antérieurs) UN UNIQUE objet JSON correspondant au schema de profile fourni. Tu ne fabriques JAMAIS d'info — si pas dans les docs, omets le champ. Aucune supposition ; uniquement des faits explicites dans le dossier.

Schéma cible (clés disponibles, à remplir uniquement si présent dans les docs) :
${SCHEMA_DESC}

Retourne ALSO une clé spéciale "_memories" : un tableau de strings courtes (1 phrase chacune) listant les FAITS MÉDICAUX importants détectés dans le dossier (ex: "Cholécystectomie en 2018", "Allergie à la pénicilline", "Hypertension diagnostiquée 2020", "Fracture du tibia 2015"). Max 25 entrées. Évite les redites.

Format réponse : UNIQUEMENT du JSON valide, pas de markdown, pas de prose, pas de fence \`\`\`. Si rien à extraire pour un champ, omets-le.`;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const apiKey = anthropicApiKey();
  if (!apiKey) return NextResponse.json({ error: "Clé Anthropic manquante" }, { status: 500 });

  const d = db();

  // 1. existing profile
  const profileRows = await d.select().from(schema.profile).orderBy(desc(schema.profile.updatedAt)).limit(1);
  const existing = decryptProfile((profileRows[0]?.data as Record<string, unknown>) ?? {});

  // 2. documents (PDFs)
  const docs = await d.select({
    id: schema.document.id,
    title: schema.document.title,
    category: schema.document.category,
    date: schema.document.date,
    textContent: schema.document.textContent,
  }).from(schema.document).orderBy(desc(schema.document.date)).limit(60);

  // 3. recent rag chunks not directly tied to docs already covered (extra safety)
  const chunks = await d.select({ text: schema.ragChunk.text })
    .from(schema.ragChunk).limit(80);

  // 4. dna insights with risk
  const dnaIns = await d.select({
    category: schema.dnaInsight.category,
    trait: schema.dnaInsight.trait,
    summary: schema.dnaInsight.summary,
    hasRisk: schema.dnaInsight.hasRisk,
    userGenotype: schema.dnaInsight.userGenotype,
  }).from(schema.dnaInsight).limit(150);

  // 5. biomarker history (unique slugs with most recent value)
  const biomarkers = d.$client.prepare(`
    SELECT name, slug, value, unit, ref_low as refLow, ref_high as refHigh, date
    FROM biomarker
    ORDER BY date DESC
    LIMIT 200
  `).all() as Array<Record<string, unknown>>;

  // 6. recent reports
  const reports = await d.select({
    kind: schema.report.kind,
    title: schema.report.title,
    body: schema.report.body,
    createdAt: schema.report.createdAt,
  }).from(schema.report).orderBy(desc(schema.report.createdAt)).limit(8);

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
      const dt = doc.date ? new Date(doc.date as Date).toISOString().slice(0, 10) : "?";
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
