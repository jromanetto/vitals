import { getSession, isDemoUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { ensureSchema } from "@/lib/db/migrate";
import { searchRag } from "@/lib/rag/search";
import { db } from "@/lib/db";
import { anthropicApiKey } from "@/lib/secrets";
import { spearman, spearmanP, pairDated, type DatedValue } from "@/lib/scoring/correlations";
import { formatProfileForLLM } from "@/lib/profile/format";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-sonnet-4-5-20250929";

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

function execTool(name: string, input: ToolInput): unknown {
  const sqlite = db().$client;
  if (name === "get_biomarker_history") {
    const slug = String(input.slug ?? "");
    const limit = Math.min(Number(input.limit ?? 100), 500);
    const rows = sqlite
      .prepare(`SELECT name, slug, value, unit, ref_low, ref_high, date FROM biomarker WHERE slug = ? ORDER BY date DESC LIMIT ?`)
      .all(slug, limit) as Array<{ name: string; slug: string; value: number; unit: string | null; ref_low: number | null; ref_high: number | null; date: number }>;
    return {
      slug,
      count: rows.length,
      points: rows.map((r) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        value: r.value,
        unit: r.unit,
        ref_low: r.ref_low,
        ref_high: r.ref_high,
        name: r.name,
      })),
    };
  }
  if (name === "search_biomarkers") {
    const q = String(input.q ?? "").toLowerCase();
    if (!q) return { matches: [] };
    const rows = sqlite
      .prepare(
        `SELECT slug, name, MAX(date) as last_date, COUNT(*) as n FROM biomarker WHERE LOWER(slug) LIKE ? OR LOWER(name) LIKE ? GROUP BY slug ORDER BY n DESC LIMIT 20`
      )
      .all(`%${q}%`, `%${q}%`);
    return { matches: rows };
  }
  if (name === "get_correlation") {
    const aKind = String(input.a_kind);
    const aKey = String(input.a_key);
    const bKind = String(input.b_kind);
    const bKey = String(input.b_key);
    const lag = Math.min(Number(input.lag_days ?? (aKind === "biomarker" || bKind === "biomarker" ? 14 : 1)), 30);
    const a = loadSeries(aKind, aKey);
    const b = loadSeries(bKind, bKey);
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
    // searchRag is async — we'll return a Promise; caller awaits.
    return searchRag(q, limit).then((hits) =>
      hits.map((h) => ({ path: h.path, snippet: h.snippet, score: Math.round(h.score * 100) / 100, doc_id: h.docId }))
    );
  }
  if (name === "get_dna_traits") {
    const cat = input.category ? String(input.category).toLowerCase() : null;
    const kw = input.keyword ? String(input.keyword).toLowerCase() : null;
    const riskOnly = Boolean(input.risk_only);
    const limit = Math.min(Number(input.limit ?? 30), 138);
    const where: string[] = [];
    const params: unknown[] = [];
    if (cat) {
      where.push("LOWER(category) = ?");
      params.push(cat);
    }
    if (kw) {
      where.push("(LOWER(trait) LIKE ? OR LOWER(summary) LIKE ?)");
      params.push(`%${kw}%`, `%${kw}%`);
    }
    if (riskOnly) where.push("has_risk = 1");
    const sql = `SELECT rsid, category, trait, user_genotype, has_risk, magnitude, summary FROM dna_insight ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY (has_risk * COALESCE(magnitude,1)) DESC LIMIT ?`;
    return { matches: sqlite.prepare(sql).all(...params, limit) };
  }
  return { error: `unknown tool ${name}` };
}

function loadSeries(kind: string, key: string): DatedValue[] {
  const sqlite = db().$client;
  if (kind === "biomarker") {
    const rows = sqlite
      .prepare(`SELECT date, value FROM biomarker WHERE slug = ? OR LOWER(name) = LOWER(?) ORDER BY date`)
      .all(key, key) as Array<{ date: number; value: number }>;
    return rows.map((r) => ({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value }));
  }
  if (kind === "symptom") {
    const rows = sqlite.prepare(`SELECT date, value FROM symptom_log WHERE key = ? ORDER BY date`).all(key) as Array<{ date: string; value: number }>;
    return rows;
  }
  if (kind === "habit") {
    const rows = sqlite.prepare(`SELECT date, value FROM habit_log WHERE key = ? ORDER BY date`).all(key) as Array<{ date: string; value: number }>;
    return rows;
  }
  if (kind === "supplement") {
    const rows = sqlite
      .prepare(`SELECT sl.date as date, sl.taken as value FROM supplement_log sl JOIN supplement s ON s.id = sl.supplement_id WHERE LOWER(s.name) LIKE LOWER(?) ORDER BY sl.date`)
      .all(`%${key}%`) as Array<{ date: string; value: number }>;
    return rows;
  }
  if (kind === "wearable") {
    const rows = sqlite.prepare(`SELECT date, value FROM wearable_metric WHERE kind = ? ORDER BY date`).all(key) as Array<{ date: string; value: number }>;
    return rows;
  }
  return [];
}

// ──────────────────────────────────────────────────────────────────
// Top correlations (precomputed, top 10)
// ──────────────────────────────────────────────────────────────────
function computeTopCorrelations(): Array<{ a: string; b: string; rho: number; p: number; n: number }> {
  const sqlite = db().$client;
  const out: Array<{ a: string; b: string; rho: number; p: number; n: number }> = [];

  const symptomLogs = sqlite.prepare(`SELECT date, key, value FROM symptom_log`).all() as Array<{ date: string; key: string; value: number }>;
  const symptomsByKey: Record<string, DatedValue[]> = {};
  for (const l of symptomLogs) (symptomsByKey[l.key] ??= []).push({ date: l.date, value: l.value });

  const bmRows = sqlite.prepare(`SELECT slug, name, date, value FROM biomarker ORDER BY date`).all() as Array<{ slug: string; name: string; date: number; value: number }>;
  const bmsBySlug: Record<string, DatedValue[]> = {};
  for (const r of bmRows) (bmsBySlug[r.slug] ??= []).push({ date: new Date(r.date).toISOString().slice(0, 10), value: r.value });

  const wearableRows = sqlite.prepare(`SELECT date, kind, value FROM wearable_metric ORDER BY date`).all() as Array<{ date: string; kind: string; value: number }>;
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

async function buildContext(userQuery: string, activeSession: number): Promise<{ context: string; sources: Hit[] }> {
  const sqlite = db().$client;

  // 1. Profile
  const profileRow = sqlite.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).get() as { data: string } | undefined;
  const profileData = profileRow ? JSON.parse(profileRow.data) : {};

  // 2. Latest 90 biomarkers (one per slug, latest)
  const bmRows = sqlite
    .prepare(
      `SELECT b.slug, b.name, b.value, b.unit, b.ref_low, b.ref_high, b.date FROM biomarker b JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date ORDER BY b.date DESC LIMIT 90`
    )
    .all() as Array<{ slug: string; name: string; value: number; unit: string | null; ref_low: number | null; ref_high: number | null; date: number }>;

  // 3. Full 138 DNA insights (no LIMIT)
  const dnaRows = sqlite
    .prepare(
      `SELECT rsid, category, trait, user_genotype as ug, has_risk as hasRisk, magnitude, summary FROM dna_insight ORDER BY (has_risk * COALESCE(magnitude,1)) DESC, category, trait`
    )
    .all() as Array<{ rsid: string; category: string; trait: string; ug: string; hasRisk: number | null; magnitude: number | null; summary: string }>;

  // 4. Active supplements + 7d adherence
  const supRows = sqlite
    .prepare(`SELECT id, name, dose, unit, timing, frequency, target_biomarker, target_snp FROM supplement WHERE ended_at IS NULL OR ended_at > ?`)
    .all(Date.now()) as Array<{ id: number; name: string; dose: string | null; unit: string | null; timing: string | null; frequency: string | null; target_biomarker: string | null; target_snp: string | null }>;
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const adherence = sqlite
    .prepare(
      `SELECT s.name, COUNT(sl.id) as taken FROM supplement s LEFT JOIN supplement_log sl ON sl.supplement_id = s.id AND sl.date >= ? AND sl.taken = 1 WHERE s.ended_at IS NULL OR s.ended_at > ? GROUP BY s.id`
    )
    .all(since7, Date.now()) as Array<{ name: string; taken: number }>;
  const adhMap = Object.fromEntries(adherence.map((a) => [a.name, a.taken]));

  // 5. Symptoms 30d (averages)
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const symptomAvg = sqlite
    .prepare(`SELECT key, AVG(value) as avg, COUNT(*) as n FROM symptom_log WHERE date >= ? GROUP BY key ORDER BY n DESC`)
    .all(since30) as Array<{ key: string; avg: number; n: number }>;

  // 6. Habits 30d (counts)
  const habitsCount = sqlite
    .prepare(`SELECT key, COUNT(*) as n FROM habit_log WHERE date >= ? GROUP BY key ORDER BY n DESC`)
    .all(since30) as Array<{ key: string; n: number }>;

  // 7. Wearables 30d averages
  const wearAvg = sqlite
    .prepare(`SELECT kind, AVG(value) as avg, COUNT(*) as n FROM wearable_metric WHERE date >= ? GROUP BY kind`)
    .all(since30) as Array<{ kind: string; avg: number; n: number }>;

  // 8. Top correlations (precomputed)
  let topCorr: Array<{ a: string; b: string; rho: number; p: number; n: number }> = [];
  try {
    topCorr = computeTopCorrelations();
  } catch {}

  // 9. Active long-term memories
  const memories = sqlite
    .prepare(`SELECT kind, body, confidence FROM chat_memory WHERE active = 1 ORDER BY kind, created_at DESC LIMIT 200`)
    .all() as Array<{ kind: string; body: string; confidence: number }>;

  // 10. Last 12 messages of current session
  const history = sqlite
    .prepare(`SELECT role, content, created_at FROM chat_message WHERE session_id = ? ORDER BY id DESC LIMIT 12`)
    .all(activeSession) as Array<{ role: string; content: string; created_at: number }>;
  history.reverse();

  // 11. RAG hits seeded by current query
  let hits: Hit[] = [];
  try {
    hits = await searchRag(userQuery, 6);
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
  ensureSchema();

  const { messages, sessionId } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[]; sessionId?: number };
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return new Response(JSON.stringify({ content: "Pas de question." }));

  const sqlite = db().$client;
  let activeSession = sessionId;
  if (!activeSession) {
    const ins = sqlite
      .prepare(`INSERT INTO chat_session (title, created_at, updated_at) VALUES (?, ?, ?)`)
      .run("Nouvelle conversation", Date.now(), Date.now());
    activeSession = Number(ins.lastInsertRowid);
  }
  sqlite.prepare(`INSERT INTO chat_message (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`).run(activeSession, "user", lastUser.content, Date.now());

  const apiKey = anthropicApiKey();
  if (!apiKey) {
    sqlite.prepare(`INSERT INTO chat_message (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`).run(activeSession, "assistant", "ANTHROPIC_API_KEY non configurée.", Date.now());
    return new Response(JSON.stringify({ content: "ANTHROPIC_API_KEY non configurée.", sessionId: activeSession, sources: [] }));
  }

  const { context, sources: ragHits } = await buildContext(lastUser.content, activeSession);
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
        // Tool-use loop, max 5 iterations
        for (let iter = 0; iter < 5; iter++) {
          const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 2500,
            system: systemPrompt,
            tools,
            messages: conv,
          });

          if (resp.stop_reason === "tool_use") {
            // Add the assistant's tool_use block to conversation
            conv.push({ role: "assistant", content: resp.content });
            // Run all tool_use blocks and append a user message with tool_result blocks
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of resp.content) {
              if (block.type === "tool_use") {
                let result: unknown;
                try {
                  const out = execTool(block.name, block.input as ToolInput);
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

          // Final turn: extract text and stream it pseudo-progressively (chunked).
          const text = resp.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");
          fullText = text;
          // Chunk text into ~40-char pieces for a streaming feel
          const chunks = text.match(/[\s\S]{1,80}/g) ?? [text];
          for (const c of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: c })}\n\n`));
          }
          break;
        }

        if (!fullText) fullText = "(le panel n'a pas produit de réponse)";

        // Persist final assistant message
        sqlite
          .prepare(`INSERT INTO chat_message (session_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(activeSession, "assistant", fullText, JSON.stringify(sourcesAccum), Date.now());
        sqlite.prepare(`UPDATE chat_session SET updated_at = ? WHERE id = ?`).run(Date.now(), activeSession);

        // Auto-rename on first exchange
        const msgCount = (sqlite.prepare(`SELECT COUNT(*) c FROM chat_message WHERE session_id = ?`).get(activeSession) as { c: number }).c;
        if (msgCount === 2) {
          try {
            const titleResp = await client.messages.create({
              model: MODEL,
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
            if (title) sqlite.prepare(`UPDATE chat_session SET title = ? WHERE id = ?`).run(title, activeSession);
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
  const sqlite = db().$client;
  const msgs = sqlite
    .prepare(`SELECT role, content FROM chat_message WHERE session_id = ? ORDER BY id ASC LIMIT 40`)
    .all(sessionId) as Array<{ role: string; content: string }>;
  if (msgs.length < 4) return;

  const transcript = msgs.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

  const client = new Anthropic({ apiKey });
  const sys = `Tu es un extracteur de mémoire médicale long-terme. Lis la conversation entre un patient et son panel médical, et extrais UNIQUEMENT les faits durables qui mériteraient d'être réinjectés dans toutes les futures conversations.

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
      model: MODEL,
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
    const insert = sqlite.prepare(
      `INSERT INTO chat_memory (kind, body, source_session_id, confidence, created_at, active) VALUES (?, ?, ?, ?, ?, 1)`
    );
    const dedup = sqlite.prepare(`SELECT id FROM chat_memory WHERE kind = ? AND body = ? LIMIT 1`);
    for (const it of parsed.items) {
      if (!allowedKinds.has(it.kind)) continue;
      const body = String(it.body).slice(0, 500).trim();
      if (!body) continue;
      const existing = dedup.get(it.kind, body) as { id: number } | undefined;
      if (existing) continue;
      insert.run(it.kind, body, sessionId, Math.min(Math.max(Number(it.confidence ?? 0.8), 0), 1), Date.now());
    }
  } catch {
    // silent — extraction is best-effort
  }
}
