"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Check, AlertCircle, FileText, Image as ImageIcon, Activity, Dna, FileSpreadsheet, Sparkles, X, Loader2 } from "lucide-react";

type Summary = { source: string; kind: string; c: number; avg: number };
type Result = {
  filename: string; size: number;
  detected: string; reason: string;
  status: "ok" | "skipped" | "error";
  message: string;
  inserted?: number; destination?: string;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "whoop-cycles": Activity, "whoop-sleep": Activity, "whoop-workouts": Activity, "whoop-journal": Activity,
  "oura-trends": Activity, "generic-csv": FileSpreadsheet,
  "dna-23andme": Dna, "pdf-document": FileText, "image": ImageIcon, "markdown-note": FileText,
  "spreadsheet": FileSpreadsheet, "unknown": FileText,
};

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportPage() {
  const [queue, setQueue] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState<Summary[]>([]);

  async function loadSummary() {
    try {
      const r = await fetch("/api/wearables");
      const d = await r.json();
      setSummary(d.summary ?? []);
    } catch {}
  }
  useEffect(() => { loadSummary(); }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const fs = Array.from(e.dataTransfer.files);
    if (fs.length) setQueue((q) => [...q, ...fs]);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []);
    if (fs.length) setQueue((q) => [...q, ...fs]);
    e.target.value = "";
  };

  function removeFromQueue(idx: number) {
    setQueue((q) => q.filter((_, i) => i !== idx));
  }

  async function uploadAll() {
    if (queue.length === 0) return;
    setUploading(true); setResults([]);
    const fd = new FormData();
    for (const f of queue) fd.append("files", f);
    try {
      const r = await fetch("/api/upload/auto", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) {
        setResults(d.results ?? []);
        setQueue([]);
        loadSummary();
      } else {
        setResults([{ filename: "—", size: 0, detected: "unknown", reason: "", status: "error", message: d.error ?? "Erreur" }]);
      }
    } catch (e) {
      setResults([{ filename: "—", size: 0, detected: "unknown", reason: "", status: "error", message: (e as Error).message }]);
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-7 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import unifié</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Glisse-dépose tout — exports Whoop/Oura, PDF d'analyses sanguines, consultations, imageries, photos d'ordonnances, ADN, notes markdown. On détecte automatiquement et on classe au bon endroit.
        </p>
      </div>

      <section
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed transition ${dragOver ? "border-emerald bg-emerald/5" : "border-border bg-card"}`}
      >
        <label className="flex flex-col items-center justify-center gap-3 px-6 py-12 cursor-pointer">
          <Upload className={`h-8 w-8 ${dragOver ? "text-emerald" : "text-muted-foreground"}`} />
          <div className="text-center">
            <div className="text-sm font-medium">Glisse tes fichiers ici ou clique pour parcourir</div>
            <div className="text-xs text-muted-foreground mt-1">Tous types acceptés · CSV, PDF, images, ADN, markdown · plusieurs à la fois</div>
          </div>
          <input type="file" multiple onChange={onPick} className="hidden" />
        </label>
      </section>

      {queue.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{queue.length} fichier{queue.length > 1 ? "s" : ""} en attente</h2>
            <button onClick={() => setQueue([])} className="text-xs text-muted-foreground hover:text-red-400 transition">Vider</button>
          </div>
          <div className="space-y-1.5">
            {queue.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary/30 text-sm">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">{fmtSize(f.size)}</span>
                <button onClick={() => removeFromQueue(i)} className="text-muted-foreground hover:text-red-400 transition" aria-label="Retirer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={uploadAll} disabled={uploading}
                  className="w-full px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…</>) : (<><Sparkles className="h-4 w-4" /> Importer {queue.length} fichier{queue.length > 1 ? "s" : ""}</>)}
          </button>
        </section>
      )}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h2 className="text-sm font-medium mb-1">Résultats ({results.length})</h2>
            {results.map((r, i) => {
              const Icon = ICONS[r.detected] ?? FileText;
              const tone = r.status === "ok" ? "border-emerald/30 bg-emerald/5" : r.status === "skipped" ? "border-border bg-secondary/30" : "border-red-500/30 bg-red-500/5";
              const accent = r.status === "ok" ? "text-emerald" : r.status === "skipped" ? "text-muted-foreground" : "text-red-400";
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                            className={`rounded-md border ${tone} p-3 flex items-start gap-3`}>
                  <Icon className={`h-4 w-4 ${accent} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{r.filename}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{r.reason}</span>
                    </div>
                    <div className={`text-xs mt-0.5 ${accent}`}>{r.message}</div>
                  </div>
                  {r.status === "ok" && <Check className="h-3.5 w-3.5 text-emerald shrink-0 mt-0.5" />}
                  {r.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />}
                </motion.div>
              );
            })}
          </motion.section>
        )}
      </AnimatePresence>

      {summary.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium mb-3">Wearables — données ingérées ({summary.length} métriques)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left py-2">Source</th><th className="text-left py-2">Métrique</th><th className="text-right py-2">N</th><th className="text-right py-2">Moyenne</th></tr>
              </thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 capitalize">{s.source}</td>
                    <td className="py-2 text-muted-foreground">{s.kind}</td>
                    <td className="py-2 text-right font-mono">{s.c}</td>
                    <td className="py-2 text-right font-mono">{s.avg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
