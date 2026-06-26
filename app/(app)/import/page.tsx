"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Check, AlertCircle, FileText, Image as ImageIcon, Activity, Dna, FileSpreadsheet, Sparkles, X, Loader2, ArrowRight, FolderUp, Camera } from "lucide-react";
import Link from "next/link";
import { WearableDashboardCard } from "@/components/wearable-dashboard-card";
import { ImageExtractModal } from "@/components/image-extract-modal";
import { PageHeader } from "@/components/page-header";

const IMAGE_EXT = /\.(jpe?g|png|webp|heic)$/i;
function isImageFile(f: File): boolean {
  return IMAGE_EXT.test(f.name) || /^image\//.test(f.type);
}

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
  const [ingestionPolling, setIngestionPolling] = useState(false);
  const [latestPanelDate, setLatestPanelDate] = useState<number | null>(null);
  const [ingestionDone, setIngestionDone] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  // When images are dropped/picked, intercept the FIRST one and open the OCR/store modal.
  // Non-image files in the same batch are queued normally.
  function handleIncoming(files: File[]) {
    if (files.length === 0) return;
    const images = files.filter(isImageFile);
    const others = files.filter((f) => !isImageFile(f));
    if (others.length) setQueue((q) => [...q, ...others]);
    if (images.length && !pendingImage) {
      setPendingImage(images[0]);
      // remaining images (if any) are queued; they'll be handled one-by-one
      if (images.length > 1) setQueue((q) => [...q, ...images.slice(1)]);
    } else if (images.length) {
      setQueue((q) => [...q, ...images]);
    }
  }

  async function loadSummary() {
    try {
      const r = await fetch("/api/wearables");
      const d = await r.json();
      setSummary(d.summary ?? []);
    } catch {}
  }
  useEffect(() => { loadSummary(); }, []);

  useEffect(() => {
    if (!ingestionPolling || latestPanelDate == null) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const lr = await fetch("/api/biomarkers/latest");
        const ld = await lr.json();
        const dates = ((ld.rows ?? []) as Array<{ date: number }>).map((r) => r.date);
        const newest = dates.length ? Math.max(...dates) : 0;
        if (newest > latestPanelDate) {
          setIngestionPolling(false);
          setIngestionDone(true);
          clearInterval(interval);
          loadSummary();
        }
      } catch {}
      // Stop after 4 minutes
      if (attempts > 80) { setIngestionPolling(false); clearInterval(interval); }
    }, 3000);
    return () => clearInterval(interval);
  }, [ingestionPolling, latestPanelDate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const fs = Array.from(e.dataTransfer.files);
    handleIncoming(fs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImage]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []);
    handleIncoming(fs);
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
        const hasIngest = (d.results ?? []).some((res: any) => ["pdf-document", "image", "markdown-note", "dna-23andme", "spreadsheet"].includes(res.detected));
        if (hasIngest) {
          // Capture current latest panel date as baseline
          const lr = await fetch("/api/biomarkers/latest");
          const ld = await lr.json();
          const dates = ((ld.rows ?? []) as Array<{ date: number }>).map((r) => r.date);
          const baseline = dates.length ? Math.max(...dates) : 0;
          setLatestPanelDate(baseline);
          setIngestionPolling(true);
          setIngestionDone(false);
        }
      } else {
        setResults([{ filename: "—", size: 0, detected: "unknown", reason: "", status: "error", message: d.error ?? "Erreur" }]);
      }
    } catch (e) {
      setResults([{ filename: "—", size: 0, detected: "unknown", reason: "", status: "error", message: (e as Error).message }]);
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Import unifié"
        description="Glisse-dépose tout — exports Whoop/Oura, PDF d'analyses sanguines, consultations, imageries, photos d'ordonnances, ADN, notes markdown. On détecte automatiquement et on classe au bon endroit."
        icon={<FolderUp className="h-5 w-5 text-emerald" />}
      />

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

      {/* Mobile: snap a photo of a paper lab result → Claude vision extracts it */}
      <label className="md:hidden flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-emerald/30 bg-emerald/5 text-emerald text-sm font-medium cursor-pointer hover:bg-emerald/10 transition">
        <Camera className="h-4 w-4" /> Photographier un bilan
        <input type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      </label>

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

      {results.length > 0 && results.some((r) => r.status === "ok" && (r.inserted ?? 0) > 0) && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-emerald/40 bg-emerald/10 p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald/20 flex items-center justify-center shrink-0">
            <Check className="h-4 w-4 text-emerald" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-emerald">
              {results.reduce((acc, r) => acc + (r.inserted ?? 0), 0).toLocaleString()} mesures ingérées · {results.filter((r) => r.detected.startsWith("pdf") || r.detected === "markdown-note" || r.detected === "dna-23andme").length} document(s) en cours d&apos;analyse
            </div>
            <div className="text-xs text-muted-foreground">Tendances HRV / FC repos / sommeil sur le dashboard. Le compte-rendu IA du dernier bilan apparaît sur Biomarqueurs dès que l&apos;ingestion est terminée (~30 sec).</div>
          </div>
          <Link href="/" className="text-xs text-emerald hover:underline flex items-center gap-1 shrink-0">
            Dashboard <ArrowRight className="h-3 w-3" />
          </Link>
        </motion.div>
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
                <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
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

      {ingestionPolling && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 text-sky-400 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sky-400">Analyse en cours…</div>
            <div className="text-xs text-muted-foreground">Le pipeline extrait les biomarqueurs et génère le compte-rendu IA. Ça peut prendre 30 sec à 2 minutes selon le nombre de pages.</div>
          </div>
        </motion.div>
      )}

      {ingestionDone && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-emerald/40 bg-emerald/10 p-4 flex items-center gap-3">
          <Check className="h-4 w-4 text-emerald shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-emerald">Nouvelle prise de sang ingérée !</div>
            <div className="text-xs text-muted-foreground">Le compte-rendu IA dédié est prêt sur la page Biomarqueurs.</div>
          </div>
          <Link href="/biomarkers" className="text-xs text-emerald hover:underline flex items-center gap-1 shrink-0">
            Voir le compte-rendu <ArrowRight className="h-3 w-3" />
          </Link>
        </motion.div>
      )}

      <WearableDashboardCard refreshKey={results.length} />

      {pendingImage && (
        <ImageExtractModal
          file={pendingImage}
          onClose={() => setPendingImage(null)}
          onStoreAsDocument={(f) => {
            // Push the image into the regular upload queue and let /api/upload/auto save it under data/divers/
            setQueue((q) => [...q, f]);
          }}
          onInserted={() => {
            // Force the dashboard polling to surface the new panel
            (async () => {
              try {
                const lr = await fetch("/api/biomarkers/latest");
                const ld = await lr.json();
                const dates = ((ld.rows ?? []) as Array<{ date: number }>).map((r) => r.date);
                const baseline = dates.length ? Math.max(...dates) - 1 : 0;
                setLatestPanelDate(baseline);
                setIngestionPolling(true);
                setIngestionDone(false);
              } catch {}
            })();
          }}
        />
      )}
    </div>
  );
}
