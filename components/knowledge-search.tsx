"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Search } from "lucide-react";
import { SkeletonCard } from "./skeleton";

type Hit = { docId: number; chunkId: number; path: string; category: string; snippet: string; score: number; date: number | null };

const CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "analyses-sang", label: "Sang" },
  { id: "consultations", label: "Consultations" },
  { id: "knowledge-base", label: "Knowledge" },
  { id: "sha-wellness", label: "SHA Wellness" },
  { id: "genetique", label: "Génétique" },
  { id: "ophtalmologie", label: "Ophtalmo" },
];

function highlight(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) => (re.test(p) ? <mark key={i} className="bg-emerald/30 text-foreground px-0.5 rounded">{p}</mark> : <span key={i}>{p}</span>));
}

export function KnowledgeSearch({ compact = false }: { compact?: boolean } = {}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("all");
  const [useAI, setUseAI] = useState(false);

  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const params = new URLSearchParams({ q, category });
    if (useAI) params.set("ai", "1");
    const r = await fetch("/api/rag/search?" + params.toString());
    const d = await r.json();
    setHits(d.hits ?? []);
    setLoading(false);
  }

  const terms = q.split(/\s+/).filter((t) => t.length >= 3);

  return (
    <div className="space-y-5">
      <form onSubmit={go} className={compact ? "flex gap-1.5" : "flex gap-2"}>
        <div className="flex-1 relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${compact ? "h-3.5 w-3.5 left-2.5" : "h-4 w-4 left-3"}`} />
          <input autoFocus={!compact} value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder={compact ? "Rechercher…" : "Vitamine D, ferritine, télomères, statines…"}
                 className={`w-full bg-secondary/40 border border-border rounded-md outline-none focus:border-primary transition ${compact ? "pl-8 pr-2 py-1.5 text-xs" : "pl-9 pr-3 py-2.5"}`} />
        </div>
        {!compact && (
          <button className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90">Rechercher</button>
        )}
      </form>

      <div className={`flex items-center gap-1 flex-wrap ${compact ? "text-[10px]" : "gap-2 text-xs"}`}>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)}
                  className={`rounded-full border transition ${compact ? "px-2 py-0.5" : "px-3 py-1 text-xs"} ${category === c.id ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}>
            {c.label}
          </button>
        ))}
        {!compact && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <button onClick={() => setUseAI(!useAI)}
                    title="Re-classement par Claude pour améliorer la pertinence"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border transition cursor-help ${useAI ? "bg-emerald/15 border-emerald/40 text-emerald" : "bg-secondary/40 border-border text-muted-foreground"}`}>
              <Sparkles className="h-3 w-3" /> AI re-rank
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {loading && <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}</div>}
        {!loading && hits !== null && hits.length === 0 && q && <div className="text-sm text-muted-foreground">Aucun résultat.</div>}
        {!loading && hits !== null && (
          <div className="space-y-3">
            {hits.map((h, i) => (
              <motion.article key={h.chunkId}
                              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.02 }}
                              className={`rounded-${compact ? "lg" : "xl"} border border-border bg-card ${compact ? "p-2.5" : "p-4"}`}>
                <div className={`flex items-center justify-between text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
                  <span className="truncate">{h.category} · {h.path.split("/").slice(-1)[0]}</span>
                  <span className="font-mono shrink-0">{h.score.toFixed(2)}</span>
                </div>
                <p className={`leading-relaxed ${compact ? "text-[11px] mt-1.5 line-clamp-3" : "text-sm mt-2"}`}>{highlight(h.snippet, terms)}</p>
                <a href={`/files/${h.docId}`} className={`text-emerald hover:underline mt-1.5 inline-block ${compact ? "text-[10px]" : "text-xs mt-2"}`}>Ouvrir →</a>
              </motion.article>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
