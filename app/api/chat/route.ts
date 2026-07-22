import { getSession, isDemoUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { searchRag } from "@/lib/rag/search";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { anthropicApiKey } from "@/lib/secrets";
import { spearman, spearmanP, pairDated, type DatedValue } from "@/lib/scoring/correlations";
import { decryptProfile } from "@/lib/crypto-fields";
import { formatProfileForLLM } from "@/lib/profile/format";
import { MODELS, THINKING } from "@/lib/ai/models.mjs";

export const runtime = "nodejs";
export const maxDuration = 120;

// Le chat streame ses deltas texte vers le client SSE : pas de `thinking` ici,
// le front ne sait pas rendre les blocs de thinking. Voir lib/ai/models.mjs.
const MODEL = MODELS.REASONING;
// Cheap, fast model for the throwaway 6-word conversation title.
const TITLE_MODEL = MODELS.CHEAP;
// Background memory extraction — structured, not user-facing; no need for Opus.
const EXTRACT_MODEL = MODELS.EXTRACTION;

// ──────────────────────────────────────────────────────────────────
// Tool definitions exposed to Claude
// ──────────────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "get_biomarker_history",
    description:
      "Retrieve full historical timeseries for a biomarker. Use when the patient asks about a trend, evolution, or specific lab value over time. Returns all data points with date, value, unit, and reference range when known.",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Biomarker slug (e.g. 'ldl_cholesterol', 'hba1c', 'tsh', 'vitamin_d_25oh')." },
        limit: { type: "number", description: "Max points to return (default 100)." },
      },
      required: ["slug"],
    },
  },
  {
    name: "search_biomarkers",
    description:
      "Fuzzy search across all biomarker slugs/names to discover the right slug before calling get_biomarker_history. Use when the patient mentions a term you are not sure maps to a known slug.",
    input_schema: {
      type: "object",
      properties: { q: { type: "string", description: "Free-text query, French or English." } },
      required: ["q"],
    },
  },
  {
    name: "get_correlation",
    description:
      "Compute Spearman rank correlation between two patient series (e.g. a symptom and a biomarker, a habit and a wearable metric). Returns rho, p-value, n, direction. Use when the patient asks 'is X correlated with Y?'.",
    input_schema: {
      type: "object",
      properties: {
        a_kind: { type: "string", enum: ["symptom", "biomarker", "habit", "supplement", "wearable"] },
        a_key: { type: "string", description: "Key/slug/name of the first series." },
        b_kind: { type: "string", enum: ["symptom", "biomarker", "habit", "supplement", "wearable"] },
        b_key: { type: "string", description: "Key/slug/name of the second series." },
        lag_days: { type: "number", description: "Date matching window in days (default 14 for biomarkers, 1 otherwise)." },
      },
      required: ["a_kind", "a_key", "b_kind", "b_key"],
    },
  },
  {
    name: "search_kb",
    description:
      "Search the personal knowledge base (PDF reports, doctor notes, ingested documents) using lexical RAG. Returns ranked snippets with file path. Use to ground claims in source documents.",
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Natural language query." },
        limit: { type: "number", description: "Max hits (default 6, max 12)." },
      },
      required: ["q"],
    },
  },
  {
    name: "get_dna_traits",
    description:
      "Filter the 138 DNA insights by category, trait keyword, or risk-only. Use when the patient asks about a specific gene, trait, or family of variants.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter (e.g. 'cardio', 'detox', 'sleep')." },
        keyword: { type: "string", description: "Optional keyword search in trait or summary." },
        risk_only: { type: "boolean", description: "Return only at-risk variants." },
        limit: { type: "number" },
      },
    },
  },
];

// ──────────────────────────────────────────────────────────────────
// Tool execution
// ──────────────────────────────────────────────────────────────────
type ToolInput = Record<string, unknown>;

async function execTool(name: string, input: ToolInput, userId: number): Promise<unknown> {
  if (name === "get_biomarker_history") {
    const slug = String(input.slug ?? "");
    const limit = Math.min(Number(input.limit ?? 100), 500);
    // Fetch this slug's series (Convex returns date ASC); take latest `limit` (DESC).
    const { rows: all } = await convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(), authUserId: userId, slugs: [slug],
    });
    const rows = all
      .slice()
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);
    return {
      slug,
      count: rows.length,
      points: rows.map((r) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        value: r.value,
        unit: r.unit,
        ref_low: r.refLow,
        ref_high: r.refHigh,
        name: r.name,
      })),
    };
  }
  if (name === "search_biomarkers") {
    const q = String(input.q ?? "").toLowerCase();
    if (!q) return { matches: [] };
    const { rows: all } = await convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(), authUserId: userId,
    });
    // Reproduce: WHERE LOWER(slug)/LOWER(name) LIKE %q% GROUP BY slug ORDER BY n DESC LIMIT 20.
    // Rows come date ASC, so the last seen per slug is the most recent (used for name/last_date).
    const bySlug = new Map<string, { slug: string; name: string; last_date: number; n: number }>();
    for (const r of all) {
      if (!(r.slug.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))) continue;
      const cur = bySlug.get(r.slug);
      if (cur) {
        cur.n += 1;
        cur.name = r.name;
        if (r.date > cur.last_date) cur.last_date = r.date;
      } else {
        bySlug.set(r.slug, { slug: r.slug, name: r.name, last_date: r.date, n: 1 });
      }
    }
    const matches = [...bySlug.values()].sort((a, b) => b.n - a.n).slice(0, 20);
    return { matches };
  }
  if (name === "get_correlation") {
    const aKind = String(input.a_kind);
    const aKey = String(input.a_key);
    const bKind = String(input.b_kind);
    const bKey = String(input.b_key);
    const lag = Math.min(Number(input.lag_days ?? (aKind === "biomarker" || bKind === "biomarker" ? 14 : 1)), 30);
    const a = await loadSeries(aKind, aKey, userId);
    const b = await loadSeries(bKind, bKey, userId);
    if (a.length < 5 || b.length < 5) return { error: "not enough data", n_a: a.length, n_b: b.length };
    const { x, y } = pairDated(a, b, lag);
    if (x.length < 5) return { error: "not enough overlapping dates", n: x.length };
    const rho = spearman(x, y);
    if (rho == null) return { error: "computation failed" };
    const p = spearmanP(rho, x.length);
    return {
      rho: Math.round(rho * 1000) / 1000,
      p: Math.round(p * 10000) / 10000,
      n: x.length,
      direction: rho > 0 ? "positive" : "negative",
      lag_days: lag,
    };
  }
  if (name === "search_kb") {
    const q = String(input.q ?? "");
    const limit = Math.min(Number(input.limit ?? 6), 12);
    const hits = await searchRag(q, limit, userId);
    return hits.map((h) => ({ path: h.path, snippet: h.snippet, score: Math.round(h.score * 100) / 100, doc_id: h.docId }));
  }
  if (name === "get_dna_traits") {
    const cat = input.category ? String(input.category).toLowerCase() : null;
    const kw = input.keyword ? String(input.keyword).toLowerCase() : null;
    const riskOnly = Boolean(input.risk_only);
    const limit = Math.min(Number(input.limit ?? 30), 138);
    const { rows: all } = await convexServer().query(api.dna.insights, {
      secret: bridgeSecret(), authUserId: userId,
    });
    // Reproduce the legacy WHERE + ORDER BY (has_risk * COALESCE(magnitude,1)) DESC.
    let filtered = all;
    if (cat) filtered = filtered.filter((r) => (r.category ?? "").toLowerCase() === cat);
    if (kw) filtered = filtered.filter((r) => (r.trait ?? "").toLowerCase().includes(kw) || (r.summary ?? "").toLowerCase().includes(kw));
    if (riskOnly) filtered = filtered.filter((r) => r.hasRisk === 1);
    const matches = filtered
      .slice()
      .sort((a, b) => (b.hasRisk ?? 0) * (b.magnitude ?? 1) - (a.hasRisk ?? 0) * (a.magnitude ?? 1))
      .slice(0, limit)
      .map((r) => ({
        rsid: r.rsid,
        category: r.category,
        trait: r.trait,
        user_genotype: r.userGenotype,
        has_risk: r.hasRisk,
        magnitude: r.magnitude,
        summary: r.summary,
      }));
    return { matches };
  }
  return { error: `unknown tool ${name}` };
}

async function loadSeries(kind: string, key: string, userId: number): Promise<DatedValue[]> {
  if (kind === "biomarker") {
    // slug = key OR LOWER(name) = LOWER(key). Convex only filters by slug, so fetch
    // all and match either way in JS (rows arrive date ASC).
    const { rows } = await convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(), authUserId: userId,
    });
    const k = key.toLowerCase();
    return rows
      .filter((r) => r.slug === key || r.name.toLowerCase() === k)
      .map((r) => ({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value }));
  }
  if (kind === "symptom") {
    // Full per-key history, date ASC (exact match for the legacy SELECT).
    const { rows } = await convexServer().query(api.symptoms.byKey, {
      secret: bridgeSecret(), authUserId: userId, key,
    });
    return rows.map((r) => ({ date: r.date, value: r.value }));
  }
  if (kind === "habit") {
    // habit_log has no per-key Convex fn; list (capped 365d) then filter by key.
    const { rows } = await convexServer().query(api.habits.list, {
      secret: bridgeSecret(), authUserId: userId, days: 3650,
    });
    return rows
      .filter((r) => r.key === key)
      .map((r) => ({ date: r.date, value: r.value }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  if (kind === "supplement") {
    // LOWER(s.name) LIKE %key% → collect matching supplement ids, then their taken logs.
    const k = key.toLowerCase();
    const { rows: supps } = await convexServer().query(api.supplements.list, {
      secret: bridgeSecret(), authUserId: userId,
    });
    const matchIds = new Set(
      supps.filter((s) => String(s.name ?? "").toLowerCase().includes(k)).map((s) => Number(s.id))
    );
    if (matchIds.size === 0) return [];
    const out: DatedValue[] = [];
    for (const id of matchIds) {
      const res = await convexServer().query(api.supplements.logHistory, {
        secret: bridgeSecret(), authUserId: userId, supplementId: id, days: 3650,
      });
      // With supplementId → per-supplement shape: { date, taken }[]
      const logs = res.rows as Array<{ date: string; taken: number }>;
      for (const l of logs) out.push({ date: l.date, value: l.taken });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  if (kind === "wearable") {
    // kind series, all sources combined (capped 365d), date ASC.
    const { rows } = await convexServer().query(api.wearables.overview, {
      secret: bridgeSecret(), authUserId: userId, days: 3650,
    });
    return rows
      .filter((r) => r.kind === key)
      .map((r) => ({ date: r.date, value: r.value }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return [];
}

// ──────────────────────────────────────────────────────────────────
// Top correlations (precomputed, top 10)
// ──────────────────────────────────────────────────────────────────
async function computeTopCorrelations(userId: number): Promise<Array<{ a: string; b: string; rho: number; p: number; n: number }>> {
  const out: Array<{ a: string; b: string; rho: number; p: number; n: number }> = [];

  const { rows: symptomLogs } = await convexServer().query(api.symptoms.list, {
    secret: bridgeSecret(), authUserId: userId, days: 3650,
  });
  const symptomsByKey: Record<string, DatedValue[]> = {};
  for (const l of symptomLogs) (symptomsByKey[l.key] ??= []).push({ date: l.date, value: l.value });

  const { rows: bmRows } = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId: userId,
  });
  const bmsBySlug: Record<string, DatedValue[]> = {};
  for (const r of bmRows) (bmsBySlug[r.slug] ??= []).push({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value });

  const { rows: wearableRows } = await convexServer().query(api.wearables.overview, {
    secret: bridgeSecret(), authUserId: userId, days: 3650,
  });
  const wearablesByKind: Record<string, DatedValue[]> = {};
  for (const r of wearableRows) (wearablesByKind[r.kind] ??= []).push({ date: r.date, value: r.value });

  for (const [symKey, symValues] of Object.entries(symptomsByKey)) {
    if (symValues.length < 5) continue;
    for (const [slug, vals] of Object.entries(bmsBySlug)) {
      if (vals.length < 3) continue;
      const { x, y } = pairDated(symValues, vals, 14);
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.4) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ a: `symptom:${symKey}`, b: `biomarker:${slug}`, rho, p, n: x.length });
    }
    for (const [wKind, wVals] of Object.entries(wearablesByKind)) {
      if (wVals.length < 5) continue;
      const { x, y } = pairDated(symValues, wVals, 1);
      if (x.length < 5) continue;
      const rho = spearman(x, y);
      if (rho == null || Math.abs(rho) < 0.3) continue;
      const p = spearmanP(rho, x.length);
      if (p > 0.15) continue;
      out.push({ a: `symptom:${symKey}`, b: `wearable:${wKind}`, rho, p, n: x.length });
    }
  }
  out.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
  return out.slice(0, 10);
}

// ──────────────────────────────────────────────────────────────────
// Build the rich context block
// ──────────────────────────────────────────────────────────────────
type Hit = Awaited<ReturnType<typeof searchRag>>[number];

async function buildContext(userQuery: string, activeSession: number, userId: number): Promise<{ context: string; sources: Hit[] }> {
  // 1. Profile (via Convex — chat is owner-scoped, so no viewUserId)
  const { data: profileEnc } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: userId,
  });
  const profileData = decryptProfile(profileEnc ? JSON.parse(profileEnc) : {});

  // 2. Latest 90 biomarkers (one per slug, latest). Convex returns date ASC, so the
  // last row seen per slug is that slug's latest; then order slugs by date DESC, cap 90.
  const { rows: bmAll } = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId: userId,
  });
  const latestBySlug = new Map<string, { slug: string; name: string; value: number; unit: string | null; ref_low: number | null; ref_high: number | null; date: number }>();
  for (const r of bmAll) {
    latestBySlug.set(r.slug, { slug: r.slug, name: r.name, value: r.value, unit: r.unit, ref_low: r.refLow, ref_high: r.refHigh, date: r.date });
  }
  const bmRows = [...latestBySlug.values()].sort((a, b) => b.date - a.date).slice(0, 90);

  // 3. Full 138 DNA insights. Sort like the legacy SQL:
  //   (has_risk * COALESCE(magnitude,1)) DESC, category ASC, trait ASC
  const { rows: dnaAll } = await convexServer().query(api.dna.insights, {
    secret: bridgeSecret(), authUserId: userId,
  });
  const dnaRows = dnaAll
    .map((d) => ({ rsid: d.rsid, category: d.category, trait: d.trait, ug: d.userGenotype, hasRisk: d.hasRisk, magnitude: d.magnitude, summary: d.summary }))
    .sort((a, b) => {
      const wa = (a.hasRisk ?? 0) * (a.magnitude ?? 1);
      const wb = (b.hasRisk ?? 0) * (b.magnitude ?? 1);
      if (wb !== wa) return wb - wa;
      const c = (a.category ?? "").localeCompare(b.category ?? "");
      if (c !== 0) return c;
      return (a.trait ?? "").localeCompare(b.trait ?? "");
    });

  // 4. Active supplements + 7d adherence
  const { rows: suppAll } = await convexServer().query(api.supplements.list, {
    secret: bridgeSecret(), authUserId: userId,
  });
  const nowMs = Date.now();
  const supRows = suppAll
    .filter((s) => s.endedAt == null || Number(s.endedAt) > nowMs)
    .map((s) => ({ id: s.id, name: s.name, dose: s.dose, unit: s.unit, timing: s.timing, frequency: s.frequency, target_biomarker: s.targetBiomarker, target_snp: s.targetSnp })) as Array<{ id: number; name: string; dose: string | null; unit: string | null; timing: string | null; frequency: string | null; target_biomarker: string | null; target_snp: string | null }>;
  // taken=1 logs over the last 7 days, counted per supplement, mapped to name.
  const takenRes = await convexServer().query(api.supplements.logHistory, {
    secret: bridgeSecret(), authUserId: userId, days: 7,
  });
  // No supplementId → all-taken-since shape: { supplementId, date }[]
  const takenLogs = takenRes.rows as Array<{ supplementId: number; date: string }>;
  const countById = new Map<number, number>();
  for (const l of takenLogs) countById.set(l.supplementId, (countById.get(l.supplementId) ?? 0) + 1);
  const adhMap: Record<string, number> = {};
  for (const s of supRows) adhMap[s.name] = countById.get(s.id) ?? 0;

  // 5. Symptoms 30d (averages)
  const { rows: sympLogs } = await convexServer().query(api.symptoms.list, {
    secret: bridgeSecret(), authUserId: userId, days: 30,
  });
  const sympAgg = new Map<string, { sum: number; n: number }>();
  for (const l of sympLogs) {
    const a = sympAgg.get(l.key) ?? { sum: 0, n: 0 };
    a.sum += l.value; a.n += 1;
    sympAgg.set(l.key, a);
  }
  const symptomAvg = [...sympAgg.entries()]
    .map(([key, a]) => ({ key, avg: a.sum / a.n, n: a.n }))
    .sort((a, b) => b.n - a.n);

  // 6. Habits 30d (counts)
  const { rows: habitLogs } = await convexServer().query(api.habits.list, {
    secret: bridgeSecret(), authUserId: userId, days: 30,
  });
  const habitAgg = new Map<string, number>();
  for (const l of habitLogs) habitAgg.set(l.key, (habitAgg.get(l.key) ?? 0) + 1);
  const habitsCount = [...habitAgg.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n);

  // 7. Wearables 30d averages
  const { rows: wearRows } = await convexServer().query(api.wearables.overview, {
    secret: bridgeSecret(), authUserId: userId, days: 30,
  });
  const wearAgg = new Map<string, { sum: number; n: number }>();
  for (const r of wearRows) {
    const a = wearAgg.get(r.kind) ?? { sum: 0, n: 0 };
    a.sum += r.value; a.n += 1;
    wearAgg.set(r.kind, a);
  }
  const wearAvg = [...wearAgg.entries()].map(([kind, a]) => ({ kind, avg: a.sum / a.n, n: a.n }));

  // 8. Top correlations (precomputed)
  let topCorr: Array<{ a: string; b: string; rho: number; p: number; n: number }> = [];
  try {
    topCorr = await computeTopCorrelations(userId);
  } catch {}

  // 9. Active long-term memories — ORDER BY kind, created_at DESC LIMIT 200
  const { rows: memAll } = await convexServer().query(api.chat.listMemory, {
    secret: bridgeSecret(), authUserId: userId, activeOnly: true,
  });
  const memories = memAll
    .map((m) => ({ kind: m.kind, body: m.body, confidence: m.confidence ?? 0, createdAt: m.createdAt }))
    .sort((a, b) => {
      const c = a.kind.localeCompare(b.kind);
      if (c !== 0) return c;
      return b.createdAt - a.createdAt;
    })
    .slice(0, 200);

  // 9b. User notes — free-text observations attached to biomarkers/docs/etc.
  const { rows: notesAll } = await convexServer().query(api.notes.list, {
    secret: bridgeSecret(), authUserId: userId,
  });
  const notes = notesAll
    .slice(0, 40)
    .map((n) => ({ t: n.targetType, tid: n.targetId, body: n.body, created_at: n.createdAt })) as Array<{ t: string; tid: string; body: string; created_at: number }>;

  // 10. Last 12 messages of current session — verify session ownership first.
  const sessOwner = await convexServer().query(api.chat.sessionOwner, {
    secret: bridgeSecret(), sessionId: activeSession,
  });
  let history: Array<{ role: string; content: string; created_at: number }> = [];
  if (sessOwner && sessOwner.userId === userId) {
    const { rows: msgs } = await convexServer().query(api.chat.listMessages, {
      secret: bridgeSecret(), sessionId: activeSession, order: "desc", limit: 12,
    });
    history = msgs.map((m) => ({ role: m.role, content: m.content, created_at: m.createdAt }));
    history.reverse();
  }

  // 11. RAG hits seeded by current query
  let hits: Hit[] = [];
  try {
    hits = await searchRag(userQuery, 6, userId);
  } catch {}

  const memorySection = memories.length
    ? `## Mémoire long-terme du patient (cross-session)\n${memories
        .map((m) => `- [${m.kind}] ${m.body} (conf=${m.confidence.toFixed(2)})`)
        .join("\n")}`
    : `## Mémoire long-terme du patient\n(vide pour l'instant)`;

  const context = [
    memorySection,
    formatProfileForLLM(profileData),
    `## Profile patient (données brutes complètes)\n\`\`\`json\n${JSON.stringify(profileData, null, 2)}\n\`\`\``,
    `## Biomarkers — 90 derniers (un par slug, plus récent)\n${bmRows
      .map((r) => {
        const range = r.ref_low != null && r.ref_high != null ? ` [ref ${r.ref_low}-${r.ref_high}]` : "";
        return `- [bm:${r.slug}] ${r.name}: ${r.value} ${r.unit ?? ""}${range} — ${new Date(r.date).toISOString().slice(0, 10)}`;
      })
      .join("\n")}`,
    `## ADN — 138 insights (full panel)\n${dnaRows
      .map(
        (d) =>
          `- [dna:${d.rsid}] [${d.category}] ${d.trait} = ${d.ug}${d.hasRisk ? " RISQUE" : ""}${d.magnitude ? ` mag=${d.magnitude}` : ""}: ${d.summary}`
      )
      .join("\n")}`,
    `## Suppléments actifs (adhérence 7j)\n${
      supRows.length
        ? supRows
            .map(
              (s) =>
                `- ${s.name} ${s.dose ?? ""}${s.unit ?? ""} ${s.frequency ?? ""} ${s.timing ?? ""} — pris ${adhMap[s.name] ?? 0}/7j${
                  s.target_biomarker ? ` → cible bm:${s.target_biomarker}` : ""
                }${s.target_snp ? ` → cible dna:${s.target_snp}` : ""}`
            )
            .join("\n")
        : "(aucun)"
    }`,
    `## Symptômes 30j (moyennes /10)\n${symptomAvg.map((s) => `- ${s.key}: ${s.avg.toFixed(2)} (n=${s.n})`).join("\n") || "(aucun log)"}`,
    `## Habitudes 30j (jours validés)\n${habitsCount.map((h) => `- ${h.key}: ${h.n}j`).join("\n") || "(aucun)"}`,
    `## Wearables 30j (moyennes)\n${wearAvg.map((w) => `- ${w.kind}: ${w.avg.toFixed(1)} (n=${w.n})`).join("\n") || "(aucun)"}`,
    notes.length
      ? `## Notes du patient (observations libres)\n${notes.map((n) => `- [${n.t}:${n.tid}] ${n.body.slice(0, 400)}`).join("\n")}`
      : "",
    `## Top corrélations Spearman (rho>0.3, p<0.15)\n${
      topCorr.length
        ? topCorr.map((c) => `- ${c.a} ↔ ${c.b}: rho=${c.rho.toFixed(2)}, p=${c.p.toFixed(3)}, n=${c.n}`).join("\n")
        : "(insuffisant)"
    }`,
    history.length
      ? `## Derniers échanges de cette session\n${history.map((h) => `${h.role.toUpperCase()}: ${h.content.slice(0, 600)}`).join("\n\n")}`
      : "",
    hits.length
      ? `## Extraits knowledge base (RAG, requête courante)\n${hits.map((h, i) => `### [doc:${h.docId}] ${h.path}\n${h.snippet}`).join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { context, sources: hits };
}

// ──────────────────────────────────────────────────────────────────
// System prompt (doctor-grade panel)
// ──────────────────────────────────────────────────────────────────
function buildSystemPrompt(context: string): string {
  return `Tu es un PANEL MÉDICAL VIRTUEL composé de :
- Un médecin de santé fonctionnelle Peter-Attia-style (Medicine 3.0, prévention, longévité)
- Un généticien clinique (interprétation SNP, variants à pénétrance variable)
- Un nutrithérapeute (micronutrition ciblée, interactions supplément×SNP×biomarker)
- Un endocrinologue (hormones, métabolisme, axe HPT/HPA, insulinorésistance)

Tu as accès complet à 15 ans d'historique patient (biomarkers, ADN 138 insights, wearables, symptômes, habitudes, suppléments) et à toute la knowledge base personnelle (rapports médicaux PDF).

PRINCIPES :
1. Réponds en FRANÇAIS, ton de médecin senior, factuel, chiffré, sans jargon inutile.
2. CITE TOUJOURS tes sources au format inline cliquable :
   - \`[bm:slug]\` pour un biomarker (ex: \`[bm:ldl_cholesterol]\`)
   - \`[dna:rsid]\` pour un variant ADN (ex: \`[dna:rs1801133]\`)
   - \`[doc:id]\` pour un document de la knowledge base (ex: \`[doc:42]\`)
3. Quand tu manques de données précises, utilise les outils (\`get_biomarker_history\`, \`get_correlation\`, \`search_kb\`, \`get_dna_traits\`, \`search_biomarkers\`). N'invente jamais une valeur.
4. Sois proactif : si tu vois une combinaison à risque (ex: APOE4 + LDL élevé + sédentarité), signale-la même si elle n'est pas demandée.
5. Recommande des actions concrètes (dose, fréquence, timing) chiffrées et nuancées par les SNP du patient.
6. Mémoire : les "Mémoires long-terme" sont des faits vérifiés cross-session — traite-les comme acquis.
7. Format : titres courts, bullets denses, pas de blabla, pas d'avertissements génériques type "consultez un médecin".

CONTEXTE PATIENT (snapshot live) :
${context}`;
}

// ──────────────────────────────────────────────────────────────────
// POST handler — multi-turn tool loop with streaming on final turn
// ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  if (isDemoUser(s.userId)) return new Response(JSON.stringify({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }), { status: 403 });

  const { messages, sessionId } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[]; sessionId?: number };
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return new Response(JSON.stringify({ content: "Pas de question." }));

  const userId = s.userId;
  let activeSessionRaw = sessionId;
  if (!activeSessionRaw) {
    const { id } = await convexServer().mutation(api.chat.createSession, {
      secret: bridgeSecret(), authUserId: userId, title: "Nouvelle conversation",
    });
    activeSessionRaw = id;
  } else {
    // Verify the session id provided actually belongs to this user.
    const owner = await convexServer().query(api.chat.sessionOwner, {
      secret: bridgeSecret(), sessionId: activeSessionRaw,
    });
    if (!owner || owner.userId !== userId) {
      return new Response(JSON.stringify({ error: "session not found" }), { status: 404 });
    }
  }
  // Capture as a const so the value stays typed `number` inside the stream closure.
  const activeSession: number = activeSessionRaw;
  await convexServer().mutation(api.chat.insertMessage, {
    secret: bridgeSecret(), authUserId: userId, sessionId: activeSession, role: "user", content: lastUser.content,
  });

  const apiKey = anthropicApiKey();
  if (!apiKey) {
    await convexServer().mutation(api.chat.insertMessage, {
      secret: bridgeSecret(), authUserId: userId, sessionId: activeSession, role: "assistant", content: "ANTHROPIC_API_KEY non configurée.",
    });
    return new Response(JSON.stringify({ content: "ANTHROPIC_API_KEY non configurée.", sessionId: activeSession, sources: [] }));
  }

  const { context, sources: ragHits } = await buildContext(lastUser.content, activeSession, userId);
  const systemPrompt = buildSystemPrompt(context);
  const client = new Anthropic({ apiKey });

  // Build conversation messages — keep them as plain user/assistant for the SDK,
  // but the tool loop adds tool_use / tool_result blocks as it iterates.
  type CMsg = Anthropic.MessageParam;
  const conv: CMsg[] = messages.map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  const sourcesAccum: { kind: string; ref: string; label?: string }[] = ragHits.map((h) => ({ kind: "doc", ref: String(h.docId), label: h.path }));

  const responseStream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        // Tool-use loop, max 5 iterations. Each turn streams its text deltas to
        // the client in real time (the model is Opus and otherwise slow to first
        // token), then we inspect the final message for tool calls.
        for (let iter = 0; iter < 5; iter++) {
          const turnStream = client.messages.stream({
            model: MODEL,
            max_tokens: 2500,
            system: systemPrompt,
            tools,
            messages: conv,
          });
          turnStream.on("text", (delta) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`));
          });
          const resp = await turnStream.finalMessage();

          const turnText = resp.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");

          if (resp.stop_reason === "tool_use") {
            // Add the assistant's tool_use block to conversation
            conv.push({ role: "assistant", content: resp.content });
            // Run all tool_use blocks and append a user message with tool_result blocks
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of resp.content) {
              if (block.type === "tool_use") {
                let result: unknown;
                try {
                  const out = execTool(block.name, block.input as ToolInput, userId);
                  result = out instanceof Promise ? await out : out;
                } catch (e) {
                  result = { error: (e as Error).message };
                }
                // Stream a debug delta so user sees tool activity
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "tool", name: block.name, input: block.input })}\n\n`
                  )
                );
                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result).slice(0, 12000) });
              }
            }
            conv.push({ role: "user", content: toolResults });
            continue;
          }

          // Final turn — text already streamed above; keep it for persistence.
          fullText = turnText;
          break;
        }

        if (!fullText) fullText = "(l'équipe médicale n'a pas produit de réponse)";

        // Persist final assistant message
        await convexServer().mutation(api.chat.insertMessage, {
          secret: bridgeSecret(), authUserId: userId, sessionId: activeSession, role: "assistant", content: fullText, sources: JSON.stringify(sourcesAccum),
        });
        await convexServer().mutation(api.chat.touchSession, {
          secret: bridgeSecret(), sessionId: activeSession,
        });

        // Auto-rename on first exchange
        const { count: msgCount } = await convexServer().query(api.chat.countMessages, {
          secret: bridgeSecret(), sessionId: activeSession,
        });
        if (msgCount === 2) {
          try {
            const titleResp = await client.messages.create({
              model: TITLE_MODEL,
              max_tokens: 30,
              messages: [{ role: "user", content: `Titre court (max 6 mots, sans guillemets) pour: USER: "${lastUser.content.slice(0, 200)}"` }],
            });
            const title = titleResp.content
              .filter((b): b is Anthropic.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("")
              .trim()
              .replace(/^["']|["']$/g, "")
              .slice(0, 60);
            if (title) await convexServer().mutation(api.chat.renameSession, {
              secret: bridgeSecret(), authUserId: userId, sessionId: activeSession, title,
            });
          } catch {}
        }

        // Background: extract long-term memories if conversation has ≥4 messages (≥2 exchanges).
        if (msgCount >= 4) {
          fireAndForgetMemoryExtraction(activeSession).catch(() => {});
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              sessionId: activeSession,
              sources: ragHits.map((h) => ({ path: h.path, snippet: h.snippet.slice(0, 200) })),
            })}\n\n`
          )
        );
        controller.close();
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: (e as Error).message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// Background memory extraction (fire-and-forget)
// ──────────────────────────────────────────────────────────────────
async function fireAndForgetMemoryExtraction(sessionId: number): Promise<void> {
  const apiKey = anthropicApiKey();
  if (!apiKey) return;
  // Derive the session owner so extracted memories are stamped with THEIR user_id.
  // Without this the INSERT below defaulted to user_id 1, leaking every beta
  // user's chat memories into the owner's account.
  const owner = await convexServer().query(api.chat.sessionOwner, {
    secret: bridgeSecret(), sessionId,
  });
  if (!owner || owner.userId == null) return;
  const userId = owner.userId;
  const { rows: msgs } = await convexServer().query(api.chat.listMessages, {
    secret: bridgeSecret(), sessionId, order: "asc", limit: 40,
  });
  if (msgs.length < 4) return;

  const transcript = msgs.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

  const client = new Anthropic({ apiKey });
  const sys = `Tu es un extracteur de mémoire médicale long-terme. Lis la conversation entre un patient et son équipe médicale, et extrais UNIQUEMENT les faits durables qui mériteraient d'être réinjectés dans toutes les futures conversations.

Catégories possibles :
- "fact" : fait médical objectif (ex: "Cholécystectomie en 2018", "Allergique aux statines")
- "preference" : préférence de soin (ex: "Préfère naturopathie aux médicaments")
- "goal" : objectif quantifié (ex: "Vise LDL < 70 mg/dL")
- "concern" : peur ou inquiétude familiale (ex: "Père Alzheimer, peur du déclin cognitif")
- "medical_history" : antécédent (ex: "Tabagisme arrêté 2015")

Règles strictes :
- N'extrais QUE des éléments mentionnés explicitement par l'USER.
- Pas de doublons triviaux. Pas d'éléments transitoires (humeur du jour, météo).
- Retourne un JSON pur (pas de markdown, pas de \`\`\`) :
{"items":[{"kind":"fact","body":"...","confidence":0.9}, ...]}
Si rien à extraire : {"items":[]}`;

  try {
    const resp = await client.messages.create({
      model: EXTRACT_MODEL,
      thinking: THINKING.EXTRACTION,
      max_tokens: 1200,
      system: sys,
      messages: [{ role: "user", content: transcript.slice(-15000) }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { items?: Array<{ kind: string; body: string; confidence?: number }> };
    if (!parsed.items?.length) return;

    const allowedKinds = new Set(["fact", "preference", "goal", "concern", "medical_history"]);
    for (const it of parsed.items) {
      if (!allowedKinds.has(it.kind)) continue;
      const body = String(it.body).slice(0, 500).trim();
      if (!body) continue;
      const { exists } = await convexServer().query(api.chat.memoryExists, {
        secret: bridgeSecret(), authUserId: userId, kind: it.kind, body,
      });
      if (exists) continue;
      await convexServer().mutation(api.chat.insertMemory, {
        secret: bridgeSecret(), authUserId: userId, kind: it.kind, body,
        sourceSessionId: sessionId, confidence: Math.min(Math.max(Number(it.confidence ?? 0.8), 0), 1),
      });
    }
  } catch {
    // silent — extraction is best-effort
  }
}
