/**
 * Welcome Report generator. Takes a SignalSet (from select-signals.ts) and
 * produces 3 markdown cards via Anthropic, then assembles the final report
 * body (cards + optional red-flag alert + disclaimer).
 *
 * All LLM calls share a single cached system prompt — the per-card user
 * prompt only varies in the structured fact context, so caching saves ~80%
 * of input tokens after the first call.
 */
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/secrets";
import type { SignalCard1, SignalCard2, SignalCard3, SignalSet } from "./select-signals";

const MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT = `Tu es un médecin fonctionnel français. Tu rédiges des cartes courtes (3 lignes max) à destination d'un patient à partir de FAITS DÉJÀ SÉLECTIONNÉS par un algorithme. Tu ne DOIS PAS:
- Inventer des chiffres, statistiques, ou faits absents du contexte fourni
- Utiliser des mots de diagnostic ("tu as un cancer", "tu es atteint de", "tu souffres de")
- Donner des certitudes ("à 100%", "certain", "sûr·e")
- Faire des recommandations de dosage médicamenteux précis

Tu DOIS:
- Tutoyer (français)
- Citer les chiffres exacts du contexte (valeur, unité, range)
- Rédiger en EXACTEMENT 3 lignes:
  Ligne 1: Constat factuel chiffré
  Ligne 2: POURQUOI ça compte (vulgarisé, sans jargon)
  Ligne 3: ACTION concrète faisable cette semaine
- Inclure une mention "discute avec ton médecin" si le sujet est sensible
- Rester sous 280 caractères au total par carte (3 lignes incluses)

Réponds UNIQUEMENT par le contenu textuel des 3 lignes, séparées par des sauts de ligne. Pas de markdown, pas de numérotation, pas de préambule.`;

type CardOutput = { title: string; body: string };

function client(): Anthropic | null {
  const key = anthropicApiKey();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

async function callClaude(userPrompt: string): Promise<string> {
  const c = client();
  if (!c) return "";
  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 220,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // @ts-expect-error — cache_control is supported but typed loose
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const blocks = res.content as Array<{ type: string; text?: string }>;
    return blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
  } catch (e) {
    console.error("[welcome-report] LLM call failed:", (e as Error).message);
    return "";
  }
}

// =================== Per-card prompts ===================

function promptCard1(card: SignalCard1): string {
  const b = card.biomarker;
  const rangeBit =
    card.optimalRange != null
      ? `optimal ${card.optimalRange.low}-${card.optimalRange.high} ${b.unit ?? ""}`
      : `pas de range optimal connu`;
  const dnaBit = card.amplifyingDna
    ? `Variante génétique amplifiante: ${card.amplifyingDna.rsid} (${card.amplifyingDna.category}) — ${card.amplifyingDna.summary ?? card.amplifyingDna.trait}`
    : "";
  const familyBit = card.amplifyingFamily
    ? `Antécédent familial pertinent: ${card.amplifyingFamily.relativeKey} a eu ${card.amplifyingFamily.diseaseLabel}`
    : "";
  return `Fait sélectionné — Biomarker hors range:
- Nom: ${b.name}
- Valeur: ${b.value} ${b.unit ?? ""}
- Ref labo: ${b.refLow ?? "?"}-${b.refHigh ?? "?"}
- Cible ${rangeBit}
- Date du test: ${new Date(b.date).toISOString().slice(0, 10)}
${dnaBit ? "- " + dnaBit : ""}
${familyBit ? "- " + familyBit : ""}

Rédige la carte "À surveiller" en 3 lignes.`;
}

function promptCard2Dna(card: { kind: "dna-protective"; dna: { rsid: string; category: string; trait: string; effect?: string | null; summary?: string | null; userGenotype?: string | null } }): string {
  const d = card.dna;
  return `Fait sélectionné — Variante génétique protective:
- rsid: ${d.rsid}
- Catégorie: ${d.category}
- Trait: ${d.trait}
- Effet: ${d.effect ?? "—"}
- Génotype patient: ${d.userGenotype ?? "—"}
- Résumé: ${d.summary ?? "—"}

Rédige la carte "Force génétique" en 3 lignes. Tonalité positive, dis pourquoi c'est une bonne nouvelle et comment maximiser cet atout.`;
}

function promptCard2Lifestyle(card: { kind: "lifestyle-fallback"; positives: string[] }): string {
  return `Fait sélectionné — Forces lifestyle (pas d'ADN uploadé):
${card.positives.map((p) => `- ${p}`).join("\n")}

Rédige la carte "Force lifestyle" en 3 lignes. Reconnais ces points forts et donne 1 action pour les maintenir/amplifier.`;
}

function promptCard3Family(card: {
  kind: "family-risk";
  relativeKey: string;
  diseaseLabel: string;
  ageOfDiagnosis?: number;
  heritability: number;
  screening?: { label: string; cadence: string; minAge?: number };
}): string {
  const relativeFr: Record<string, string> = {
    father: "Père",
    mother: "Mère",
    paternalGrandfather: "Grand-père paternel",
    paternalGrandmother: "Grand-mère paternelle",
    maternalGrandfather: "Grand-père maternel",
    maternalGrandmother: "Grand-mère maternelle",
    siblings: "Frère/sœur",
    children: "Enfant",
    paternalUncleAunt: "Oncle/tante paternel·le",
    maternalUncleAunt: "Oncle/tante maternel·le",
  };
  const rel = relativeFr[card.relativeKey] ?? card.relativeKey;
  return `Fait sélectionné — Risque familial actionnable:
- Relative: ${rel}
- Maladie: ${card.diseaseLabel}
- Âge diagnostic: ${card.ageOfDiagnosis ?? "inconnu"}
- Heritability: ${Math.round(card.heritability * 100)}%
${card.screening ? `- Dépistage applicable: ${card.screening.label} (tous les ${card.screening.cadence})${card.screening.minAge ? ", à partir de " + card.screening.minAge + " ans" : ""}` : ""}

Rédige la carte "Risque familial" en 3 lignes. Inclus le dépistage recommandé si présent. Mentionne "discute avec ton médecin" si pertinent.`;
}

function promptCard3Symptoms(card: { kind: "symptoms-fallback"; redFlagSymptoms: string[]; otherSymptoms: string[] }): string {
  const all = [...card.redFlagSymptoms, ...card.otherSymptoms];
  return `Fait sélectionné — Symptômes actifs déclarés (pas d'antécédent familial connu):
- Symptômes: ${all.join(", ")}
${card.redFlagSymptoms.length ? `- Red flags à discuter avec un médecin: ${card.redFlagSymptoms.join(", ")}` : ""}

Rédige la carte "Symptômes à surveiller" en 3 lignes. Reconnaître les symptômes, expliquer en 1 phrase l'investigation typique, recommander discussion médicale si red flag.`;
}

// =================== Public API ===================

export type GeneratedCard = {
  index: number;
  kind: "biomarker" | "dna-protective" | "lifestyle-fallback" | "family-risk" | "symptoms-fallback" | "empty-state";
  title: string;
  body: string;
};

export async function generateWelcomeReport(signals: SignalSet): Promise<{
  cards: GeneratedCard[];
  redFlagAlert?: { labels: string[]; body: string };
  bodyMarkdown: string;
}> {
  const cards: GeneratedCard[] = [];

  // Card 1
  if (signals.card1) {
    const body = await callClaude(promptCard1(signals.card1));
    cards.push({
      index: 0,
      kind: "biomarker",
      title: "À surveiller",
      body: body || `Ton ${signals.card1.biomarker.name} est à ${signals.card1.biomarker.value} ${signals.card1.biomarker.unit ?? ""} — hors range optimal. Une discussion avec ton médecin est recommandée.`,
    });
  }

  // Card 2
  if (signals.card2) {
    const prompt =
      signals.card2.kind === "dna-protective"
        ? promptCard2Dna(signals.card2)
        : promptCard2Lifestyle(signals.card2);
    const body = await callClaude(prompt);
    cards.push({
      index: 1,
      kind: signals.card2.kind,
      title: signals.card2.kind === "dna-protective" ? "Force génétique" : "Force lifestyle",
      body: body || (signals.card2.kind === "dna-protective" ? "Tu as une variante génétique favorable. Maintiens un mode de vie sain pour en bénéficier au max." : "Tu as déjà de bonnes bases de mode de vie. Continue."),
    });
  }

  // Card 3
  if (signals.card3) {
    const prompt =
      signals.card3.kind === "family-risk"
        ? promptCard3Family(signals.card3)
        : promptCard3Symptoms(signals.card3);
    const body = await callClaude(prompt);
    const title = signals.card3.kind === "family-risk" ? "Risque familial" : "Symptômes à surveiller";
    cards.push({
      index: 2,
      kind: signals.card3.kind,
      title,
      body:
        body ||
        (signals.card3.kind === "family-risk"
          ? `Antécédent familial: ${signals.card3.diseaseLabel}. Un dépistage régulier est recommandé. Discute avec ton médecin.`
          : "Tu as déclaré quelques symptômes — n'hésite pas à en parler à un médecin si ça persiste."),
    });
  }

  // Zero-data fallback — when select-signals couldn't find anything to talk
  // about, we still show a card so the user doesn't land on an empty page.
  // This is the new-tester first-run case (signed up, didn't upload anything).
  if (cards.length === 0) {
    cards.push({
      index: 0,
      kind: "empty-state",
      title: "Prêt à commencer",
      body:
        "On n'a pas encore assez de données pour faire ressortir des signaux personnalisés.\n" +
        "Importe un bilan sanguin (PDF), un export 23andMe ou un CSV wearable depuis l'écran Import.\n" +
        "Dès le premier document, ton Welcome Report se remplit avec des insights chiffrés.",
    });
  }

  // Red flag alert (non-skippable)
  let redFlagAlert: { labels: string[]; body: string } | undefined;
  if (signals.redFlagAlert && signals.redFlagAlert.labels.length > 0) {
    redFlagAlert = {
      labels: signals.redFlagAlert.labels,
      body: `Tu as signalé un ou plusieurs symptômes nécessitant un avis médical rapide : ${signals.redFlagAlert.labels.join(
        ", ",
      )}. Prends rendez-vous avec ton médecin dans les meilleurs délais.`,
    };
  }

  // Markdown body for storage / email
  const lines: string[] = [];
  lines.push("# Bienvenue sur ton dossier Vitals\n");
  lines.push("Voici ce qu'on a remarqué dans tes données. Trois choses à actionner.\n");
  if (redFlagAlert) {
    lines.push(`\n> ⚠️ **À discuter rapidement avec ton médecin** : ${redFlagAlert.labels.join(", ")}\n`);
  }
  for (const c of cards) {
    lines.push(`\n## ${c.title}\n`);
    lines.push(c.body);
  }
  lines.push(
    "\n\n---\nCette analyse est générée par IA à partir des données que tu nous as fournies. Vitals n'est pas un dispositif médical et ne remplace jamais un avis médical. Discute toujours les résultats avec un professionnel de santé qualifié.",
  );

  return { cards, redFlagAlert, bodyMarkdown: lines.join("\n") };
}
