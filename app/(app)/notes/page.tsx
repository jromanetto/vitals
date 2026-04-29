"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Tag, Activity, Dna, FileText, Search } from "lucide-react";

type Note = {
  id: number; targetType: string; targetId: string;
  body: string; tags: string | null;
  createdAt: number; updatedAt: number;
};

const TYPE_ICON = { biomarker: Activity, dna: Dna, file: FileText } as const;

export default function NotesIndexPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [tag, setTag] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    const r = await fetch(`/api/notes${params.toString() ? "?" + params : ""}`);
    const d = await r.json();
    setNotes(d.rows ?? []);
    setTags(d.tags ?? []);
  }
  useEffect(() => { load(); }, [tag]);

  function targetLink(n: Note): string {
    if (n.targetType === "biomarker") return `/biomarkers/${n.targetId}`;
    if (n.targetType === "dna") return `/dna/${n.targetId}`;
    if (n.targetType === "file") return `/files/${n.targetId}`;
    return "#";
  }

  const filtered = notes.filter((n) => !filter || n.body.toLowerCase().includes(filter.toLowerCase()) || (n.tags ?? "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="text-muted-foreground mt-1 text-sm">Toutes tes annotations sur biomarkers, ADN, fichiers — taggées et cherchables.</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer le contenu…"
                 className="w-full bg-secondary/40 border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        {tag && <button onClick={() => setTag(null)} className="text-xs px-3 py-1.5 rounded-md bg-emerald/15 border border-emerald/30 text-emerald">Tag: {tag} ×</button>}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground">Tags:</span>
          {tags.map((t) => (
            <button key={t} onClick={() => setTag(t)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${tag === t ? "bg-emerald/15 border-emerald/40 text-emerald" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}>
              <Tag className="h-2.5 w-2.5 inline mr-1" />{t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Aucune note trouvée. Ajoute-en depuis n'importe quel biomarker, trait ADN ou fichier.
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((n, i) => {
          const Icon = TYPE_ICON[n.targetType as keyof typeof TYPE_ICON] ?? FileText;
          return (
            <motion.li key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                       className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2 text-xs">
                <Link href={targetLink(n)} className="inline-flex items-center gap-1.5 text-emerald hover:underline">
                  <Icon className="h-3 w-3" />
                  <span className="capitalize">{n.targetType}</span>
                  <span className="text-muted-foreground">/</span>
                  <span>{n.targetId}</span>
                </Link>
                <span className="text-muted-foreground">{new Date(n.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{n.body}</div>
              {n.tags && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {n.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                    <button key={t} onClick={() => setTag(t)} className="text-xs px-1.5 py-0.5 rounded-full bg-emerald/10 text-emerald border border-emerald/20 hover:bg-emerald/20">
                      <Tag className="h-2.5 w-2.5 inline mr-0.5" />{t}
                    </button>
                  ))}
                </div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
