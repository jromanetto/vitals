// Source de vérité unique pour les modèles Claude utilisés par Vitals.
// En .mjs (et pas .ts) pour être importable à la fois par le code Next.js et
// par les scripts détachés (scripts/gen-report.mjs, scripts/gen-doctor-pack.mjs)
// qui tournent sous node sans transpilation.
//
// Trois tiers, choisis par usage :
//
//   REASONING  — analyse user-facing où la qualité se voit (rapports, chat,
//                plan d'action, commentaires biomarqueurs, cartes Welcome).
//                Toujours appelé avec `thinking: { type: "adaptive" }` : sur
//                Opus 4.8 le thinking est OFF si le champ est absent, et le
//                modèle a alors tendance à déverser son raisonnement dans la
//                réponse visible — ce qui pollue le markdown des rapports.
//
//   EXTRACTION — parsing structuré (PDF, vision, import profil, re-rank RAG).
//                Toujours appelé avec `thinking: { type: "disabled" }` : sur
//                Sonnet 5 le thinking est ON par défaut quand le champ est
//                absent, et il consommerait le budget `max_tokens` prévu pour
//                le JSON de sortie (troncature silencieuse).
//
//   CHEAP      — tâches jetables non user-facing (titre de conversation).
//
// Régle : quand on ajoute un appel LLM, on choisit un tier ici. Pas de model ID
// en dur dans un endpoint.

export const MODELS = {
  REASONING: "claude-opus-4-8",
  EXTRACTION: "claude-sonnet-5",
  CHEAP: "claude-haiku-4-5",
};

// Config `thinking` à passer avec chaque tier. Voir le commentaire ci-dessus :
// ces valeurs sont explicites parce que les défauts diffèrent d'un modèle à
// l'autre et changent d'une génération à la suivante.
//
// L'annotation JSDoc est nécessaire : dans un fichier .mjs, TypeScript infère
// `{ type: string }` et le SDK Anthropic attend une union discriminée sur des
// littéraux. Sans elle, chaque appel `messages.create` échoue au typecheck.
/** @type {{ REASONING: { type: "adaptive" }, EXTRACTION: { type: "disabled" } }} */
export const THINKING = {
  REASONING: { type: "adaptive" },
  EXTRACTION: { type: "disabled" },
};
