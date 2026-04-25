import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  ensureSchema();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "overview";

  const d = db();
  const profile = (d.$client.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).get() as { data: string } | undefined)?.data;
  const profileObj = profile ? JSON.parse(profile) : {};
  const bms = d.$client.prepare(`SELECT b.name, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date FROM biomarker b JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date`).all() as Array<{ name: string; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number }>;
  const dnaInsights = d.$client.prepare(`SELECT rsid, category, trait, user_genotype as ug, has_risk as hasRisk, summary FROM dna_insight WHERE has_risk = 1 ORDER BY magnitude DESC NULLS LAST LIMIT 30`).all();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let body = "";
  let title = "Vue d'ensemble santé";

  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const sys = "Tu es un médecin de santé fonctionnelle expérimenté. Tu rédiges en français un rapport de synthèse, structuré en markdown, factuel, personnalisé. Tu cites les valeurs réelles. Tu termines par 5 actions concrètes priorisées.";
    const prompt = `Génère un rapport de santé "${kind}" pour ce profil.

PROFIL:
\`\`\`json
${JSON.stringify(profileObj, null, 2)}
\`\`\`

BIOMARQUEURS LATENTS (${bms.length}):
${bms.map((b) => `- ${b.name}: ${b.value} ${b.unit ?? ""} (ref ${b.refLow ?? "?"}–${b.refHigh ?? "?"}) — ${new Date(b.date).toISOString().slice(0,10)}`).join("\n")}

ADN — TRAITS À SURVEILLER (${dnaInsights.length}):
${(dnaInsights as Array<{ rsid: string; trait: string; ug: string; summary: string }>).map((i) => `- ${i.trait} [${i.rsid} = ${i.ug}]: ${i.summary}`).join("\n")}

Sections attendues:
1. Synthèse exécutive (3 lignes max)
2. Points forts (biomarqueurs en zone optimale, traits ADN protecteurs)
3. Points à surveiller (biomarqueurs hors range + ADN à risque)
4. Corrélations notables (biomarqueurs + ADN qui se renforcent)
5. 5 actions priorisées avec rationale.`;
    const resp = await client.messages.create({ model: "claude-sonnet-4-5-20250929", max_tokens: 3000, system: sys, messages: [{ role: "user", content: prompt }] });
    body = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
    title = `Vue d'ensemble — ${new Date().toLocaleDateString("fr-FR")}`;
  } else {
    body = `# Rapport ${kind}\n\nClé ANTHROPIC_API_KEY manquante. Ajoute-la dans .env pour générer des rapports AI.\n\nDonnées disponibles:\n- ${bms.length} biomarqueurs récents\n- ${(dnaInsights as unknown[]).length} traits ADN à surveiller\n`;
    title = `Données brutes — ${new Date().toLocaleDateString("fr-FR")}`;
  }

  const ins = await d.insert(schema.report).values({ kind, title, body, meta: { profile: !!profile, biomarkers: bms.length, dnaInsights: (dnaInsights as unknown[]).length } }).returning({ id: schema.report.id });
  return NextResponse.redirect(new URL(`/reports/${ins[0].id}`, req.url));
}
