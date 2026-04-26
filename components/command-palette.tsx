"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Activity, BookOpen, Clock, Dna, FileText, LayoutDashboard, MessageSquare, Search, User } from "lucide-react";

type Hit = { kind: "biomarker" | "dna" | "report" | "doc" | "page"; title: string; subtitle?: string; href: string };

const ICONS: Record<Hit["kind"], typeof Search> = {
  page: LayoutDashboard, biomarker: Activity, dna: Dna, report: FileText, doc: BookOpen,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) { setQ(""); setActive(0); inputRef.current?.focus(); } }, [open]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setHits(d.hits ?? []);
      setActive(0);
    }, 100);
    return () => clearTimeout(t);
  }, [q]);

  function go(h: Hit) { setOpen(false); router.push(h.href); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Rechercher biomarker, ADN, fichier, page…"
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">esc</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
              {hits.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun résultat.</div>}
              {hits.map((h, i) => {
                const Icon = ICONS[h.kind];
                const isActive = i === active;
                return (
                  <button
                    key={h.href + i} onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${isActive ? "bg-secondary" : "hover:bg-secondary/40"}`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate">{h.title}</div>
                      {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{h.kind}</span>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-border bg-secondary/20 text-[10px] text-muted-foreground flex items-center gap-3">
              <span>↑↓ naviguer</span><span>↵ ouvrir</span><span>esc fermer</span>
              <span className="ml-auto"><kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">⌘K</kbd> pour ouvrir</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
