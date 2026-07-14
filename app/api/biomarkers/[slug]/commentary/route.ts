import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
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
  if (!userId || !authId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const metaKey = JSON.stringify({ slug });

  // Cached? Convex has no meta-column filter, so list biomarker_insight reports
  // (scoped to the effective/view user) and find the one keyed by this slug's
  // meta. Rows come back created_at DESC, so find() yields the latest.
  const { rows: insightRows } = await convexServer().query(api.reports.list, {
    secret: bridgeSecret(), authUserId: authId, viewUserId: userId, kind: "biomarker_insight",
  });
  const cached = insightRows.find((r) => r.meta === metaKey);
  if (cached && Date.now() - cached.createdAt < 30 * 24 * 3600 * 1000) {
    return NextResponse.json({ body: cached.body, cached: true });
  }

  // Biomarker rows via Convex (resolves read user through active consent, fail-closed).
  const { rows } = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId: authId, viewUserId: userId, slugs: [slug],
  });
  if (rows.length === 0) return NextResponse.json({ error: "no data" }, { status: 404 });
  const meta = rows[0];
  const md = META_BY_SLUG[slug];

  const apiKey = anthropicApiKey();
  if (!apiKey) return NextResponse.json({ body: "Clé Anthropic manquante." });

  const { data: profileData } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: authId, viewUserId: userId,
  });
  const profile = profileData ? anonymizeProfile(decryptProfile(JSON.parse(profileData))) : {};

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
    await convexServer().mutation(api.reports.insert, {
      secret: bridgeSecret(), authUserId: authId, kind: "biomarker_insight",
      title: `${meta.name} — analyse`, body, meta: metaKey,
    });
  }
  return NextResponse.json({ body, cached: false });
}
