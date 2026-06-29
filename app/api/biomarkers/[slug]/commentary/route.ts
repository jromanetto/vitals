import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/secrets";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import { decryptProfile } from "@/lib/crypto-fields";
import { anonymizeProfile } from "@/lib/anonymize";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const userId = await effectiveUserId();
  const authId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const { slug } = await params;
  const sqlite = db().$client;

  // Cached? Scope by user_id so each user has their own cached commentary.
  const cached = sqlite.prepare(`SELECT body, created_at FROM report WHERE kind = 'biomarker_insight' AND meta = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`).get(JSON.stringify({ slug }), userId) as { body: string; created_at: number } | undefined;
  if (cached && Date.now() - cached.created_at < 30 * 24 * 3600 * 1000) {
    return NextResponse.json({ body: cached.body, cached: true });
  }

  const rows = sqlite.prepare(`SELECT name, value, unit, ref_low as refLow, ref_high as refHigh, date FROM biomarker WHERE slug = ? AND user_id = ? ORDER BY date ASC`).all(slug, userId) as Array<{ name: string; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number }>;
  if (rows.length === 0) return NextResponse.json({ error: "no data" }, { status: 404 });
  const meta = rows[0];
  const md = META_BY_SLUG[slug];

  const apiKey = anthropicApiKey();
  if (!apiKey) return NextResponse.json({ body: "Clé Anthropic manquante." });

  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as { data: string } | undefined;
  const profile = profileRow ? anonymizeProfile(decryptProfile(JSON.parse(profileRow.data))) : {};

  const client = new Anthropic({ apiKey });
  const sys = "Tu es médecin de santé fonctionnelle. Tu commentes UN biomarqueur en français, en markdown court (3-5 paragraphes max). Tu cites les chiffres réels du patient et la cible optimale. Tu termines par 2-3 actions concrètes personnalisées.";
  const prompt = `Biomarqueur: ${meta.name}
Mesures (${rows.length}):
${rows.map((r) => `  ${new Date(r.date).toISOString().slice(0,10)}: ${r.value} ${r.unit ?? ""} (ref ${r.refLow ?? "?"}–${r.refHigh ?? "?"})`).join("\n")}

${md ? `Cibles:
- Optimal: ${md.optimalLow}–${md.optimalHigh} ${md.unit}
- Longévité: ${md.longevityLow}–${md.longevityHigh} ${md.unit}
- Pourquoi ça compte: ${md.whyMatters}` : ""}

Profile pertinent: âge ${profile.birthDate ? new Date().getFullYear() - new Date(profile.birthDate as string).getFullYear() : "?"}, sexe ${profile.sex ?? "?"}, activité ${profile.activityLevel ?? "?"}, régime ${profile.dietType ?? "?"}.

Donne ton analyse en 3-5 paragraphes courts, factuels.`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-5-20250929", max_tokens: 1500,
    system: sys, messages: [{ role: "user", content: prompt }],
  });
  const body = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");

  // Cache it (scoped to this user).
  // Only persist the generated insight when looking at your OWN data — never
  // write to a household member's account while merely viewing it.
  if (userId === authId) {
    sqlite.prepare(`INSERT INTO report (kind, title, body, meta, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)`).run("biomarker_insight", `${meta.name} — analyse`, body, JSON.stringify({ slug }), Date.now(), userId);
  }
  return NextResponse.json({ body, cached: false });
}
