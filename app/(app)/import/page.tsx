"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Check, AlertCircle } from "lucide-react";

type Summary = { source: string; kind: string; c: number; avg: number };

export default function ImportPage() {
  const [source, setSource] = useState<"oura" | "whoop" | "generic">("oura");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ ok: boolean; inserted?: number; kinds?: string[]; error?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<Summary[]>([]);

  async function load() {
    const r = await fetch("/api/wearables");
    const d = await r.json();
    setSummary(d.summary ?? []);
  }
  useEffect(() => { load(); }, []);

  async function upload() {
    if (!file) return;
    setUploading(true); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("source", source);
    const r = await fetch("/api/wearables", { method: "POST", body: fd });
    const d = await r.json();
    setUploading(false);
    if (r.ok) setResult({ ok: true, inserted: d.inserted, kinds: d.kinds });
    else setResult({ ok: false, error: d.error });
    load();
  }

  return (
    <div className="space-y-7 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import wearables</h1>
        <p className="text-muted-foreground mt-1 text-sm">Importe ton historique HRV, RHR, sommeil depuis Oura, Whoop ou un CSV générique.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          {(["oura", "whoop", "generic"] as const).map((src) => (
            <button key={src} onClick={() => setSource(src)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition ${source === src ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}>
              {src === "oura" ? "Oura Ring" : src === "whoop" ? "Whoop" : "CSV générique"}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground rounded-md bg-secondary/30 p-3">
          {source === "oura" && <>Export depuis Oura → Personal data → Trends → Export CSV. Fichier `oura_trends.csv`.</>}
          {source === "whoop" && <>Export Whoop → Account Settings → Data Export → Sleeps + Recoveries CSV.</>}
          {source === "generic" && <>Format: première ligne = entêtes, première colonne contient "date" (YYYY-MM-DD), autres colonnes = métriques numériques.</>}
        </div>

        <label className="flex items-center justify-center gap-2 px-4 py-8 rounded-md border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{file ? file.name : "Choisir un fichier CSV…"}</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
        </label>

        <button onClick={upload} disabled={!file || uploading}
                className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
          {uploading ? "Import en cours…" : "Importer"}
        </button>

        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className={`rounded-md p-3 text-sm flex items-start gap-2 ${result.ok ? "bg-emerald/10 border border-emerald/30 text-emerald" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
            {result.ok ? <Check className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
            <div>
              {result.ok ? (
                <>{result.inserted} mesures importées · {result.kinds?.join(", ")}</>
              ) : (
                <>Erreur : {result.error}</>
              )}
            </div>
          </motion.div>
        )}
      </section>

      {summary.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium mb-3">Données importées</h2>
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
        </section>
      )}
    </div>
  );
}
