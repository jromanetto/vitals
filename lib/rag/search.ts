import "server-only";
import { db } from "@/lib/db";

const STOPWORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "ou", "à", "au", "aux", "en", "dans", "sur", "pour",
  "par", "avec", "sans", "que", "qui", "quoi", "ce", "cet", "cette", "ces", "se", "ne", "pas", "plus", "moins",
  "the", "of", "and", "or", "to", "in", "for", "on", "at", "by", "with", "is", "are", "was", "were", "be", "been",
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

type Hit = { docId: number; chunkId: number; path: string; category: string; snippet: string; score: number; date: number | null };

export async function searchRag(query: string, limit = 10): Promise<Hit[]> {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return [];
  const sqlite = db().$client;

  const placeholders = terms.map(() => "?").join(",");
  const rows = sqlite.prepare(`
    SELECT k.chunk_id as chunkId, c.doc_id as docId, c.text as text, d.path as path, d.category as category, d.date as date,
           SUM(k.tf) as score
    FROM rag_keyword k
    JOIN rag_chunk c ON c.id = k.chunk_id
    JOIN document d ON d.id = c.doc_id
    WHERE k.term IN (${placeholders})
    GROUP BY k.chunk_id
    ORDER BY score DESC
    LIMIT ?
  `).all(...terms, limit) as Array<{ chunkId: number; docId: number; text: string; path: string; category: string; date: number | null; score: number }>;

  return rows.map((r) => ({
    docId: r.docId,
    chunkId: r.chunkId,
    path: r.path,
    category: r.category,
    date: r.date,
    score: r.score,
    snippet: snippet(r.text, terms),
  }));
}

function snippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let bestIdx = 0; let bestScore = 0;
  for (let i = 0; i < text.length; i += 50) {
    const win = lower.slice(i, i + 220);
    let s = 0; for (const t of terms) if (win.includes(t)) s++;
    if (s > bestScore) { bestScore = s; bestIdx = i; }
  }
  let snip = text.slice(Math.max(0, bestIdx - 30), bestIdx + 240).replace(/\s+/g, " ").trim();
  if (snip.length > 260) snip = snip.slice(0, 260) + "…";
  return snip;
}
