import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { ensureSchema } from "@/lib/db/migrate";
import { searchRag } from "@/lib/rag/search";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const { messages } = await req.json() as { messages: { role: "user" | "assistant"; content: string }[] };
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ content: "Pas de question." });

  const hits = await searchRag(lastUser.content, 8);
  const profileRows = db().$client.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).all() as Array<{ data: string }>;
  const profileData = profileRows[0]?.data ? JSON.parse(profileRows[0].data) : {};
  const bmRows = db().$client.prepare(`SELECT b.name, b.value, b.unit, b.date FROM biomarker b JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date LIMIT 80`).all();

  const context = [
    `## Profile utilisateur\n\`\`\`json\n${JSON.stringify(profileData, null, 2)}\n\`\`\``,
    `## Derniers biomarkers (top 80)\n${(bmRows as Array<{ name: string; value: number; unit: string | null; date: number }>).map((r) => `- ${r.name}: ${r.value} ${r.unit ?? ""} (${new Date(r.date).toISOString().slice(0, 10)})`).join("\n")}`,
    `## Extraits de la knowledge base (RAG)\n${hits.map((h) => `### ${h.path}\n${h.snippet}`).join("\n\n")}`,
  ].join("\n\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      content: "ANTHROPIC_API_KEY n'est pas configurée sur le serveur. Ajoute la clé dans .env pour activer le chat AI.",
      sources: hits.map((h) => ({ path: h.path, snippet: h.snippet.slice(0, 200) })),
    });
  }

  const client = new Anthropic({ apiKey });
  const sys = `Tu es l'assistant santé personnel de Julien Romanetto. Tu réponds en français, de façon concise, factuelle et personnalisée.
Tu cites tes sources quand tu utilises les extraits ci-dessous. Tu ne donnes pas de conseil médical normatif — tu présentes les faits, les corrélations, et tu suggères des pistes à creuser avec un médecin si pertinent.

CONTEXTE PERSONNEL:
${context}`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1500,
    system: sys,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
  return NextResponse.json({
    content: text,
    sources: hits.map((h) => ({ path: h.path, snippet: h.snippet.slice(0, 200) })),
  });
}
