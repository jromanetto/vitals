import { getSession } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { ensureSchema } from "@/lib/db/migrate";
import { searchRag } from "@/lib/rag/search";
import { db } from "@/lib/db";
import { anthropicApiKey } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  ensureSchema();

  const { messages, sessionId } = await req.json() as { messages: { role: "user" | "assistant"; content: string }[]; sessionId?: number };
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return new Response(JSON.stringify({ content: "Pas de question." }));

  const sqlite = db().$client;
  let activeSession = sessionId;
  if (!activeSession) {
    const ins = sqlite.prepare(`INSERT INTO chat_session (title, created_at, updated_at) VALUES (?, ?, ?)`).run("Nouvelle conversation", Date.now(), Date.now());
    activeSession = Number(ins.lastInsertRowid);
  }
  sqlite.prepare(`INSERT INTO chat_message (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`).run(activeSession, "user", lastUser.content, Date.now());

  const hits = await searchRag(lastUser.content, 8);
  const profileRow = sqlite.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).get() as { data: string } | undefined;
  const profileData = profileRow ? JSON.parse(profileRow.data) : {};
  const bmRows = sqlite.prepare(`SELECT b.name, b.value, b.unit, b.date FROM biomarker b JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date LIMIT 80`).all() as Array<{ name: string; value: number; unit: string | null; date: number }>;
  const dnaRows = sqlite.prepare(`SELECT category, trait, user_genotype as ug, has_risk as hasRisk, summary FROM dna_insight ORDER BY (has_risk * COALESCE(magnitude,1)) DESC LIMIT 30`).all();

  const context = [
    `## Profile utilisateur\n\`\`\`json\n${JSON.stringify(profileData, null, 2)}\n\`\`\``,
    `## Derniers biomarkers (top 80)\n${bmRows.map((r) => `- ${r.name}: ${r.value} ${r.unit ?? ""} (${new Date(r.date).toISOString().slice(0, 10)})`).join("\n")}`,
    `## ADN — top 30 traits\n${(dnaRows as Array<{ category: string; trait: string; ug: string; hasRisk: number | null; summary: string }>).map((d) => `- [${d.category}] ${d.trait} = ${d.ug}${d.hasRisk ? " ⚠" : ""}: ${d.summary}`).join("\n")}`,
    `## Extraits de la knowledge base (RAG)\n${hits.map((h, i) => `### [${i + 1}] ${h.path}\n${h.snippet}`).join("\n\n")}`,
  ].join("\n\n");

  const apiKey = anthropicApiKey();
  if (!apiKey) {
    sqlite.prepare(`INSERT INTO chat_message (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`).run(activeSession, "assistant", "ANTHROPIC_API_KEY non configurée.", Date.now());
    return new Response(JSON.stringify({ content: "ANTHROPIC_API_KEY non configurée.", sessionId: activeSession, sources: [] }));
  }

  const client = new Anthropic({ apiKey });
  const sys = `Tu es l'assistant santé personnel de Julien Romanetto. Tu réponds en français, factuel, personnalisé. Cite les extraits avec [1] [2] etc.

CONTEXTE PERSONNEL:
${context}`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-5-20250929", max_tokens: 2000, system: sys,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  let fullText = "";
  const sources = hits.map((h) => h.path);

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`));
          }
        }
        // Persist final
        sqlite.prepare(`INSERT INTO chat_message (session_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?)`).run(activeSession, "assistant", fullText, JSON.stringify(sources), Date.now());
        sqlite.prepare(`UPDATE chat_session SET updated_at = ? WHERE id = ?`).run(Date.now(), activeSession);

        // Auto-rename on first exchange
        const msgCount = (sqlite.prepare(`SELECT COUNT(*) c FROM chat_message WHERE session_id = ?`).get(activeSession) as { c: number }).c;
        if (msgCount === 2) {
          try {
            const titleResp = await client.messages.create({
              model: "claude-sonnet-4-5-20250929", max_tokens: 30,
              messages: [{ role: "user", content: `Titre court (max 6 mots, sans guillemets) pour: USER: "${lastUser.content.slice(0, 200)}"` }],
            });
            const title = titleResp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim().replace(/^["']|["']$/g, "").slice(0, 60);
            if (title) sqlite.prepare(`UPDATE chat_session SET title = ? WHERE id = ?`).run(title, activeSession);
          } catch {}
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", sessionId: activeSession, sources: hits.map((h) => ({ path: h.path, snippet: h.snippet.slice(0, 200) })) })}\n\n`));
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
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
