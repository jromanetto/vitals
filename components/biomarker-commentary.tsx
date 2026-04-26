"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";

export function BiomarkerCommentary({ slug }: { slug: string }) {
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);

  async function load(force = false) {
    setLoading(true);
    const r = await fetch(`/api/biomarkers/${slug}/commentary${force ? "?force=1" : ""}`);
    const d = await r.json();
    setBody(d.body ?? null);
    setCached(!!d.cached);
    setLoading(false);
  }

  useEffect(() => { load(); }, [slug]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-emerald" />
          Analyse personnalisée
        </div>
        {cached && <span className="text-[10px] text-muted-foreground">Cache 30j</span>}
      </div>
      {loading && !body ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Claude analyse tes données…
        </div>
      ) : body ? (
        <div className="prose prose-invert prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
      ) : (
        <div className="text-sm text-muted-foreground">Aucun commentaire disponible.</div>
      )}
    </motion.div>
  );
}
