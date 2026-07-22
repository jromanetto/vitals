import Anthropic from "@anthropic-ai/sdk";
import { MODELS, THINKING } from "@/lib/ai/models.mjs";
import type { EngineOutput } from "./rules-engine";
import { FOOD_BY_SLUG } from "./food-database";
import type { NutritionPlan, NutritionPref } from "./types";

const SYSTEM = `Tu es nutritionniste fonctionnel francophone. Tu reçois :
- des règles biomarker → aliments déjà appliquées,
- des règles SNP → aliments déjà appliquées,
- les préférences alimentaires de l'utilisateur,
- un pattern alimentaire suggéré.

Ton job : synthétiser le tout en un PLAN JSON cohérent. Tu n'inventes PAS de nouveaux aliments — tu utilises uniquement les slugs fournis. Tu ne contredis pas les règles, tu les expliques.

Réponds STRICTEMENT en JSON valide selon ce schéma, sans aucun texte hors JSON :

{
  "dietPattern": { "key": "string", "label": "string", "description": "string" },
  "macros": { "protein": "string", "carbs": "string", "fat": "string" },
  "rationale": "string (markdown FR, 3-4 paragraphes max)",
  "mealIdeas": {
    "breakfast": ["string", ...],
    "lunch": ["string", ...],
    "dinner": ["string", ...],
    "snacks": ["string", ...]
  },
  "favoredFoodsSorted": ["food-slug", ...],
  "avoidFoodsSorted": ["food-slug", ...]
}

Règles :
- mealIdeas : 3-5 idées concrètes par catégorie, en français, mentionnant des aliments parmi ceux fournis.
- rationale : ton chaleureux, factuel, expliquer POURQUOI ce pattern + 2-3 leviers actionnables aujourd'hui.
- favoredFoodsSorted / avoidFoodsSorted : tu peux réordonner mais utilise uniquement les slugs fournis.
- Aucun emoji dans rationale ni mealIdeas.`;

function summarizeRules(engine: EngineOutput): string {
  const favorRules = engine.rules.filter((r) => r.action === "favor").slice(0, 20);
  const avoidRules = engine.rules.filter((r) => r.action === "avoid").slice(0, 15);
  const lines: string[] = [];
  lines.push("## Règles FAVOR appliquées");
  for (const r of favorRules) {
    lines.push(`- [${r.source}/${r.priority}] ${r.subjectLabel} (${r.benefit}) — ${r.reason}`);
    lines.push(`  → aliments: ${r.foodSlugs.join(", ")}`);
  }
  lines.push("\n## Règles AVOID appliquées");
  for (const r of avoidRules) {
    lines.push(`- [${r.source}/${r.priority}] ${r.subjectLabel} (${r.benefit}) — ${r.reason}`);
    lines.push(`  → aliments: ${r.foodSlugs.join(", ")}`);
  }
  return lines.join("\n");
}

function listAllowedSlugs(engine: EngineOutput): string {
  const favor = engine.favoredFoods.map((f) => `${f.slug} (${FOOD_BY_SLUG[f.slug]?.label ?? "?"})`).join(", ");
  const avoid = engine.avoidFoods.map((f) => `${f.slug} (${FOOD_BY_SLUG[f.slug]?.label ?? "?"})`).join(", ");
  return `Slugs FAVOR autorisés: ${favor}\nSlugs AVOID autorisés: ${avoid}`;
}

export async function generatePlan(opts: {
  apiKey: string;
  engine: EngineOutput;
  prefs: NutritionPref;
  profileSummary: string;
}): Promise<NutritionPlan> {
  const { apiKey, engine, prefs, profileSummary } = opts;

  const userPrompt = `## Profil
${profileSummary}

## Préférences alimentaires
- Régime: ${prefs.dietType}
- Allergies: ${(prefs.allergies ?? []).join(", ") || "aucune"}
- Aversions: ${prefs.aversions || "aucune"}
- Budget: ${prefs.budget}
- Cuisines préférées: ${(prefs.cuisines ?? []).join(", ") || "non spécifié"}

## Pattern alimentaire suggéré par le moteur
${engine.suggestedPattern.key} — ${engine.suggestedPattern.label}
Raison: ${engine.suggestedPattern.reason}
Description: ${engine.suggestedPattern.description}

${summarizeRules(engine)}

${listAllowedSlugs(engine)}

Génère le plan JSON maintenant.`;

  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: MODELS.REASONING,
    thinking: THINKING.REASONING,
    // Marge pour le thinking, qui partage le budget max_tokens avec la réponse.
    max_tokens: 12000,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("Claude did not return JSON");
  const json = text.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(json) as Omit<NutritionPlan, "rules" | "generatedAt" | "cached">;

  // Sanitize: keep only slugs we know
  parsed.favoredFoodsSorted = (parsed.favoredFoodsSorted ?? []).filter((s) => FOOD_BY_SLUG[s]);
  parsed.avoidFoodsSorted = (parsed.avoidFoodsSorted ?? []).filter((s) => FOOD_BY_SLUG[s]);

  return {
    ...parsed,
    rules: engine.rules,
    generatedAt: Date.now(),
    cached: false,
  };
}

/** Fallback plan if Claude is unavailable — purely rules-based, no narrative. */
export function fallbackPlan(engine: EngineOutput): NutritionPlan {
  return {
    dietPattern: { key: engine.suggestedPattern.key, label: engine.suggestedPattern.label, description: engine.suggestedPattern.description },
    macros: { protein: "1.2–1.6 g/kg", carbs: "30–45%", fat: "35–45%" },
    rationale: `## Plan basé sur tes données\n\n${engine.suggestedPattern.reason}\n\nLes aliments à privilégier et à éviter ci-dessous sont déduits directement de ton dernier bilan et de ton ADN. Active la clé Anthropic pour obtenir une synthèse narrative et des idées de repas personnalisées.`,
    mealIdeas: {
      breakfast: ["Œufs + avocat + roquette", "Yaourt grec + myrtilles + noix", "Saumon fumé + pain de seigle"],
      lunch: ["Salade quinoa + lentilles + légumes verts", "Bowl saumon sauvage + brocoli + huile d'olive", "Poulet fermier + patate douce + chou-fleur"],
      dinner: ["Sardines grillées + ratatouille", "Curry de légumes + riz complet", "Soupe de légumes + œufs mollets"],
      snacks: ["Amandes + chocolat noir 85%", "Pomme + beurre d'amande", "Carottes + houmous"],
    },
    favoredFoodsSorted: engine.favoredFoods.map((f) => f.slug),
    avoidFoodsSorted: engine.avoidFoods.map((f) => f.slug),
    rules: engine.rules,
    generatedAt: Date.now(),
    cached: false,
  };
}
