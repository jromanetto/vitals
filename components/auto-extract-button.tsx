"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, FileSearch, Loader2, X } from "lucide-react";

type Stats = {
  docs: number;
  ragChunks: number;
  biomarkers: number;
  dnaInsights: number;
  reports: number;
  contextChars: number;
};

type ExtractResp = {
  extracted: Record<string, unknown>;
  existing: Record<string, unknown>;
  memories: string[];
  stats: Stats;
};

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function AutoExtractButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractResp | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [selectedMemories, setSelectedMemories] = useState<Record<number, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState<{ fields: number; memories: number } | null>(null);

  async function run() {
    setLoading(true); setError(null); setData(null); setDone(null);
    try {
      const r = await fetch("/api/profile/auto-extract", { method: "POST" });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.error || `HTTP ${r.status}`);
      } else {
        setData(j as ExtractResp);
        const sel: Record<string, boolean> = {};
        for (const k of Object.keys(j.extracted || {})) sel[k] = true;
        setSelectedFields(sel);
        const mem: Record<number, boolean> = {};
        (j.memories || []).forEach((_: string, i: number) => { mem[i] = true; });
        setSelectedMemories(mem);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!data) return;
    setApplying(true);
    try {
      const fields: Record<string, unknown> = {};
      for (const [k, on] of Object.entries(selectedFields)) {
        if (on && k in data.extracted) fields[k] = data.extracted[k];
      }
      const memories: string[] = data.memories.filter((_, i) => selectedMemories[i]);
      const r = await fetch("/api/profile/auto-extract/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, memories }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.error || `HTTP ${r.status}`);
      } else {
        setDone({ fields: j.fieldsApplied || 0, memories: j.memoriesCreated || 0 });
        setTimeout(() => { window.location.reload(); }, 1200);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  function close() {
    setData(null);
    setError(null);
    setDone(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-purple-500/10 border border-purple-500/30 text-sm text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-50"
        title="Claude lit tous tes PDFs, biomarkers et ADN pour pré-remplir ton profile"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
        {loading ? "Claude lit tes 30 PDFs…" : "Extraction depuis mes docs"}
      </button>
      {error && !data && (
        <div className="mt-2 text-xs text-red-400">{error}</div>
      )}
      <AnimatePresence>
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={close}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <h2 className="font-medium">Extraction depuis ton dossier</h2>
                  <span className="text-xs text-muted-foreground">
                    {data.stats.docs} PDFs · {data.stats.biomarkers} biomarkers · {data.stats.dnaInsights} ADN · {data.stats.reports} rapports · {(data.stats.contextChars / 1000).toFixed(1)}k chars
                  </span>
                </div>
                <button onClick={close} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                {done && (
                  <div className="rounded-md bg-emerald/10 border border-emerald/30 px-4 py-3 text-sm text-emerald">
                    Appliqué : {done.fields} champ(s) profile, {done.memories} mémoire(s) médicale(s) ajoutée(s). Rechargement…
                  </div>
                )}

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                      Champs proposés ({Object.keys(data.extracted).length})
                    </h3>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => {
                        const all: Record<string, boolean> = {};
                        for (const k of Object.keys(data.extracted)) all[k] = true;
                        setSelectedFields(all);
                      }} className="text-muted-foreground hover:text-foreground">Tout cocher</button>
                      <span className="text-muted-foreground">·</span>
                      <button onClick={() => setSelectedFields({})} className="text-muted-foreground hover:text-foreground">Tout décocher</button>
                    </div>
                  </div>
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/40 text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 w-8"></th>
                          <th className="text-left px-3 py-2 w-1/4">Champ</th>
                          <th className="text-left px-3 py-2">Existant</th>
                          <th className="text-left px-3 py-2">Proposé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.extracted).map(([k, v]) => {
                          const existingVal = (data.existing as Record<string, unknown>)[k];
                          const same = JSON.stringify(existingVal) === JSON.stringify(v);
                          return (
                            <tr key={k} className="border-t border-border">
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="checkbox"
                                  checked={!!selectedFields[k]}
                                  onChange={(e) => setSelectedFields((s) => ({ ...s, [k]: e.target.checked }))}
                                />
                              </td>
                              <td className="px-3 py-2 align-top font-mono text-purple-300">{k}</td>
                              <td className="px-3 py-2 align-top text-muted-foreground break-words">{formatVal(existingVal)}</td>
                              <td className={`px-3 py-2 align-top break-words ${same ? "text-muted-foreground" : "text-emerald"}`}>{formatVal(v)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {data.memories.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                        Faits médicaux à mémoriser ({data.memories.length})
                      </h3>
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => {
                          const all: Record<number, boolean> = {};
                          data.memories.forEach((_, i) => { all[i] = true; });
                          setSelectedMemories(all);
                        }} className="text-muted-foreground hover:text-foreground">Tout cocher</button>
                        <span className="text-muted-foreground">·</span>
                        <button onClick={() => setSelectedMemories({})} className="text-muted-foreground hover:text-foreground">Tout décocher</button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {data.memories.map((m, i) => (
                        <label key={i} className="flex items-start gap-2 px-3 py-1.5 rounded bg-secondary/30 border border-border text-xs cursor-pointer hover:bg-secondary/50">
                          <input
                            type="checkbox"
                            checked={!!selectedMemories[i]}
                            onChange={(e) => setSelectedMemories((s) => ({ ...s, [i]: e.target.checked }))}
                            className="mt-0.5"
                          />
                          <span>{m}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                )}

                {error && <div className="text-sm text-red-400">{error}</div>}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
                <button onClick={close} className="px-3 py-2 rounded-md bg-secondary border border-border text-sm hover:bg-secondary/70">Annuler</button>
                <button
                  onClick={apply}
                  disabled={applying || done !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
                >
                  {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Appliquer la sélection
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
