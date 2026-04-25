"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Hit = { docId: number; chunkId: number; path: string; category: string; snippet: string; score: number; date: number | null };

export function KnowledgeSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const r = await fetch("/api/rag/search?q=" + encodeURIComponent(q));
    const d = await r.json();
    setHits(d.hits ?? []);
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={go} className="flex gap-2">
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Ex: vitamine D, ferritine, télomères, statines…"
          className="flex-1 bg-secondary/40 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition"
        />
        <button className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90">Rechercher</button>
      </form>

      <AnimatePresence>
        {loading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">Recherche…</motion.div>}
        {!loading && hits.length === 0 && q && <div className="text-sm text-muted-foreground">Aucun résultat.</div>}
        <div className="space-y-3">
          {hits.map((h, i) => (
            <motion.article
              key={h.chunkId}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.02 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{h.category} · {h.path.split("/").slice(-1)[0]}</span>
                <span className="font-mono">{h.score.toFixed(2)}</span>
              </div>
              <p className="text-sm mt-2 leading-relaxed">{h.snippet}</p>
            </motion.article>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
