/**
 * Read-only MCP tools over a Vitals user's own health data. Every tool is
 * scoped to the `userId` resolved from the bearer token; nothing here writes.
 * Handlers return human-readable text (the model reads it directly).
 */
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { decryptProfile } from "@/lib/crypto-fields";
import { computeLongevityScore } from "@/lib/scoring/longevity";
import type { McpTool } from "@/lib/mcp/protocol";

const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);

function biomarkerStatus(value: number, refLow: number | null, refHigh: number | null): string {
  if (refLow != null && value < refLow) return "bas";
  if (refHigh != null && value > refHigh) return "haut";
  if (refLow != null || refHigh != null) return "ok";
  return "—";
}

function scoped(userId: number) {
  return { secret: bridgeSecret(), authUserId: userId, viewUserId: userId };
}

/** Build the tool registry for one authenticated user. */
export function buildTools(userId: number): McpTool[] {
  const cx = convexServer();

  return [
    {
      name: "get_profile_summary",
      description:
        "Résumé du profil santé de l'utilisateur (âge, sexe, taille, poids, activité, pathologies, médicaments, allergies, objectifs). Contexte de base pour tout conseil.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => {
        const { data } = await cx.query(api.profile.get, scoped(userId));
        if (!data) return "Aucun profil renseigné.";
        const p = decryptProfile(JSON.parse(data)) as Record<string, unknown>;
        const dob = (p.birthDate || p.dob || p.dateOfBirth) as string | undefined;
        let age: number | null = null;
        if (dob) {
          const d = new Date(dob);
          if (!isNaN(d.getTime())) age = Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5));
        }
        const arr = (x: unknown) => (Array.isArray(x) ? x.join(", ") : (x as string) || "");
        const lines = [
          `Prénom: ${p.firstName ?? "—"}`,
          `Âge: ${age ?? "—"}${p.sex ? ` · Sexe: ${p.sex}` : ""}`,
          `Taille: ${p.height ?? "—"} cm · Poids: ${p.weight ?? "—"} kg`,
          `Activité: ${p.activityLevel ?? "—"}`,
          `Pathologies: ${arr(p.chronicConditions) || "aucune"}`,
          `Médicaments: ${arr(p.medications) || "aucun"}`,
          `Allergies: ${arr(p.allergies) || "aucune"}`,
          `Antécédents familiaux: ${arr(p.familyDiseases) || "—"}`,
          `Objectifs: ${arr(p.primaryGoals) || "—"}`,
        ];
        return lines.join("\n");
      },
    },

    {
      name: "list_biomarkers",
      description:
        "Dernière valeur de chaque biomarqueur sanguin, avec plage de référence et statut (bas/ok/haut). Filtre optionnel par catégorie.",
      inputSchema: {
        type: "object",
        properties: { category: { type: "string", description: "ex: lipides, métabolique, rénal…" } },
        additionalProperties: false,
      },
      handler: async (args) => {
        const { rows } = await cx.query(api.biomarkers.all, scoped(userId));
        if (!rows.length) return "Aucun biomarqueur enregistré.";
        // latest per slug
        const latest = new Map<string, (typeof rows)[number]>();
        for (const r of rows) {
          const cur = latest.get(r.slug);
          if (!cur || r.date > cur.date) latest.set(r.slug, r);
        }
        let list = [...latest.values()];
        const cat = (args.category as string | undefined)?.toLowerCase();
        if (cat) list = list.filter((r) => (r.category || "").toLowerCase().includes(cat));
        list.sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || ""));
        const body = list
          .map((r) => {
            const ref = r.refLow != null || r.refHigh != null ? ` (ref ${r.refLow ?? "?"}–${r.refHigh ?? "?"})` : "";
            return `- ${r.name}: ${r.value} ${r.unit ?? ""}${ref} [${biomarkerStatus(r.value, r.refLow, r.refHigh)}] — ${day(r.date)}`;
          })
          .join("\n");
        return `${list.length} biomarqueurs (dernière valeur):\n${body}`;
      },
    },

    {
      name: "get_biomarker",
      description: "Historique chronologique complet d'un biomarqueur (par slug, ex 'ldl'), avec tendance première→dernière mesure.",
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string", description: "identifiant du marqueur, ex 'ldl', 'hba1c', 'ferritin'" } },
        required: ["slug"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const slug = String(args.slug || "").toLowerCase();
        if (!slug) return "Paramètre 'slug' requis.";
        const { rows } = await cx.query(api.biomarkers.all, { ...scoped(userId), slugs: [slug] });
        if (!rows.length) return `Aucune mesure pour '${slug}'.`;
        const pts = [...rows].sort((a, b) => a.date - b.date);
        const first = pts[0];
        const last = pts[pts.length - 1];
        const delta = pts.length > 1 && first.value !== 0 ? ` · variation ${(((last.value - first.value) / first.value) * 100).toFixed(1)}%` : "";
        const series = pts.map((r) => `  ${day(r.date)}: ${r.value} ${r.unit ?? ""}`).join("\n");
        const ref = last.refLow != null || last.refHigh != null ? ` (ref ${last.refLow ?? "?"}–${last.refHigh ?? "?"})` : "";
        return `${last.name}${ref} — ${pts.length} mesures, statut actuel [${biomarkerStatus(last.value, last.refLow, last.refHigh)}]${delta}\n${series}`;
      },
    },

    {
      name: "get_dna_insights",
      description:
        "Variants génétiques (23andMe) triés par risque. Chaque entrée: gène/trait, génotype, magnitude, résumé. Filtres optionnels par catégorie et risque uniquement.",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string" },
          only_risk: { type: "boolean", description: "ne renvoyer que les variants à risque" },
          limit: { type: "number", description: "max de variants (défaut 40)" },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        const { rows } = await cx.query(api.dna.insights, scoped(userId));
        let list = rows;
        if (args.only_risk) list = list.filter((r) => r.hasRisk);
        const limit = Math.min(Number(args.limit) || 40, 120);
        const shown = list.slice(0, limit);
        if (!shown.length) return "Aucun variant.";
        const body = shown
          .map((r) => `- [${r.category}] ${r.trait} = ${r.userGenotype ?? "?"}${r.hasRisk ? " ⚠" : r.isProtective ? " ✓" : ""} (mag ${r.magnitude ?? "?"}): ${r.summary ?? ""}`)
          .join("\n");
        const more = list.length > shown.length ? `\n… ${list.length - shown.length} variants supplémentaires non affichés (augmente 'limit').` : "";
        return `${shown.length}/${list.length} variants:\n${body}${more}`;
      },
    },

    {
      name: "list_supplements",
      description: "Supplémentation actuelle (stack en cours): nom, dose, timing, fréquence, cible. Indique aussi combien ont été pris aujourd'hui.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => {
        const res = await cx.query(api.supplements.list, scoped(userId));
        const active = res.rows.filter((s) => s.endedAt == null).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        if (!active.length) return "Aucun supplément actif.";
        const body = active
          .map((s) => `- ${s.name}${s.dose ? ` ${s.dose}${s.unit ?? ""}` : ""}${s.timing ? ` · ${s.timing}` : ""}${s.frequency ? ` · ${s.frequency}` : ""}${s.targetBiomarker ? ` → cible ${s.targetBiomarker}` : ""}`)
          .join("\n");
        return `${active.length} suppléments actifs (${res.takenToday?.length ?? 0} pris aujourd'hui):\n${body}`;
      },
    },

    {
      name: "get_vitals_score",
      description: "Vitals Score longévité du jour (0-100) et sa décomposition (biomarqueurs, ADN, mode de vie, tendances) + complétude des données.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => {
        const s = await computeLongevityScore(userId);
        const c = s.completeness;
        return [
          `Vitals Score: ${s.total}/100`,
          `- Biomarqueurs: ${s.biomarkers}/40`,
          `- ADN: ${s.dna}/25`,
          `- Mode de vie: ${s.lifestyle}/20`,
          `- Tendances: ${s.trends}/15`,
          c ? `Complétude: ${c.doneCount}/${c.totalCount} sources (${(c.sources || []).join(", ")})` : "",
        ].filter(Boolean).join("\n");
      },
    },

    {
      name: "list_reports",
      description: "Rapports IA générés (aperçu: id, type, titre, date, statut). Utilise get_report pour lire le contenu complet.",
      inputSchema: {
        type: "object",
        properties: { kind: { type: "string", description: "type de rapport, ex 'overview', 'cardiovascular'…" } },
        additionalProperties: false,
      },
      handler: async (args) => {
        const { rows } = await cx.query(api.reports.list, { ...scoped(userId), ...(args.kind ? { kind: String(args.kind) } : {}) });
        if (!rows.length) return "Aucun rapport.";
        return rows.map((r) => `- #${r.id} [${r.kind}] ${r.title} — ${day(r.createdAt)}${r.status ? ` (${r.status})` : ""}`).join("\n");
      },
    },

    {
      name: "get_report",
      description: "Contenu markdown complet d'un rapport IA par son id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "number" } },
        required: ["id"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const id = Number(args.id);
        if (!Number.isFinite(id)) return "Paramètre 'id' (nombre) requis.";
        const { row } = await cx.query(api.reports.get, { ...scoped(userId), id });
        if (!row) return `Rapport #${id} introuvable.`;
        return `# ${row.title}\n\n${row.body ?? "(vide)"}`;
      },
    },

    {
      name: "get_symptoms",
      description: "Journal des symptômes récents (intensité 0-10). Paramètre 'days' (défaut 30). Renvoie la moyenne récente par symptôme.",
      inputSchema: {
        type: "object",
        properties: { days: { type: "number" } },
        additionalProperties: false,
      },
      handler: async (args) => {
        const days = Math.min(Number(args.days) || 30, 365);
        const { rows } = await cx.query(api.symptoms.list, { ...scoped(userId), days });
        if (!rows.length) return "Aucun symptôme journalisé.";
        const agg = new Map<string, { sum: number; n: number }>();
        for (const l of rows) {
          const a = agg.get(l.key) || { sum: 0, n: 0 };
          a.sum += l.value;
          a.n += 1;
          agg.set(l.key, a);
        }
        return [...agg.entries()]
          .map(([k, a]) => `- ${k}: ${(a.sum / a.n).toFixed(1)}/10 (moyenne sur ${a.n} entrées, ${days}j)`)
          .join("\n");
      },
    },
  ];
}
