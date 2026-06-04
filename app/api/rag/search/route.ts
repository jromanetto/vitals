import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/db/migrate";
import { searchRag } from "@/lib/rag/search";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category");
  const useAI = url.searchParams.get("ai") === "1";

  if (!q.trim()) return NextResponse.json({ hits: [] });

  // BM25 first pass — wider net if AI rerank
  let hits = await searchRag(q, useAI ? 25 : 20, s.userId);

  // Optional category filter
  if (category && category !== "all") {
    hits = hits.filter((h) => (h.path ?? "").toLowerCase().includes(category.toLowerCase()) || (h.category ?? "").toLowerCase() === category.toLowerCase());
  }

  // AI re-rank
  const apiKey = anthropicApiKey();
  if (useAI && apiKey && hits.length > 1) {
    try {
      const client = new Anthropic({ apiKey });
      const numbered = hits.map((h, i) => `[${i + 1}] ${h.snippet}`).join("\n\n");
      const sys = "Tu es un moteur de recherche médical. On te donne une question et N extraits indexés [1..N]. Tu retournes une liste JSON des indices les plus pertinents, du plus pertinent au moins, séparés par virgule. UNIQUEMENT le JSON array, ex: [3, 1, 7].";
      const resp = await client.messages.create({
        model: "claude-sonnet-4-5-20250929", max_tokens: 200, system: sys,
        messages: [{ role: "user", content: `Question: ${q}\n\nExtraits:\n${numbered}` }],
      });
      const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      const match = text.match(/\[([\d,\s]+)\]/);
      if (match) {
        const order = match[1].split(",").map((n) => parseInt(n.trim(), 10) - 1).filter((n) => Number.isInteger(n) && n >= 0 && n < hits.length);
        if (order.length > 0) hits = order.map((i) => hits[i]).slice(0, 10);
      }
    } catch (e) {
      console.error("[rerank] failed:", e);
    }
  } else {
    hits = hits.slice(0, 10);
  }

  return NextResponse.json({ hits });
}
