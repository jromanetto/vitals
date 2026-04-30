"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, X, AlertCircle, Sparkles, FileImage, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Extracted = {
  name: string;
  slug: string | null;
  category: string | null;
  value: number;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  matched: boolean;
};

type Mode = "choose" | "extracting" | "preview" | "inserting";

export function ImageExtractModal({ file, onClose, onStoreAsDocument, onInserted }: {
  file: File;
  onClose: () => void;
  onStoreAsDocument: (file: File) => void;
  onInserted: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [panelLab, setPanelLab] = useState<string>("");
  const [rows, setRows] = useState<Extracted[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runExtract() {
    setMode("extracting");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/biomarkers/extract-image", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erreur d'extraction");
      if (d.date) setDate(d.date);
      if (d.panelLab) setPanelLab(d.panelLab);
      setRows((d.biomarkers ?? []) as Extracted[]);
      setMode("preview");
    } catch (e) {
      setError((e as Error).message);
      setMode("choose");
    }
  }

  function updateRow(idx: number, patch: Partial<Extracted>) {
    setRows((rs) => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  async function runInsert() {
    if (rows.length === 0) { toast.error("Aucun biomarqueur à insérer"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast.error("Date invalide (YYYY-MM-DD)"); return; }
    setMode("inserting");
    try {
      const r = await fetch("/api/biomarkers/insert-extracted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          biomarkers: rows.map(({ matched: _matched, ...rest }) => rest),
          source: `vision-ocr:${file.name}`,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erreur d'insertion");
      const skippedCount = Array.isArray(d.skipped) ? d.skipped.length : 0;
      toast.success(
        skippedCount
          ? `${d.inserted} biomarqueur(s) inséré(s), ${skippedCount} ignoré(s)`
          : `${d.inserted} biomarqueur(s) inséré(s)`
      );
      onInserted();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setMode("preview");
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl my-auto"
        >
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <FileImage className="h-5 w-5 text-emerald shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">Photo de bilan détectée</div>
                <div className="text-xs text-muted-foreground truncate">{file.name}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition" aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>

          {mode === "choose" && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Que veux-tu faire de cette photo&nbsp;?
              </p>
              {error && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <button onClick={runExtract}
                  className="text-left rounded-xl border border-emerald/40 bg-emerald/10 p-4 hover:bg-emerald/15 transition">
                  <div className="flex items-center gap-2 text-emerald font-medium text-sm">
                    <Sparkles className="h-4 w-4" /> Extraire les biomarqueurs (OCR)
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    Claude Vision lit la photo et extrait les valeurs. Tu valides avant insertion.
                  </div>
                </button>
                <button onClick={() => { onStoreAsDocument(file); onClose(); }}
                  className="text-left rounded-xl border border-border bg-secondary/30 p-4 hover:bg-secondary/50 transition">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <FileImage className="h-4 w-4" /> Stocker comme document
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    Sauvegarde la photo dans data/divers/ sans extraction.
                  </div>
                </button>
              </div>
            </div>
          )}

          {mode === "extracting" && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-emerald" />
              Extraction en cours… Claude Vision analyse la photo.
            </div>
          )}

          {(mode === "preview" || mode === "inserting") && (
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs space-y-1">
                  <span className="text-muted-foreground">Date du bilan</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-secondary/50 border border-border text-sm" />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-muted-foreground">Laboratoire (optionnel)</span>
                  <input type="text" value={panelLab} onChange={(e) => setPanelLab(e.target.value)}
                    placeholder="Cerballiance, Synlab…"
                    className="w-full px-2.5 py-1.5 rounded-md bg-secondary/50 border border-border text-sm" />
                </label>
              </div>

              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>{rows.length} biomarqueur{rows.length > 1 ? "s" : ""} extrait{rows.length > 1 ? "s" : ""}</span>
                <span className="text-[10px] uppercase tracking-wider">Édite ou supprime avant insertion</span>
              </div>

              <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-2.5 py-2 font-medium">Nom</th>
                      <th className="text-right px-2.5 py-2 font-medium">Valeur</th>
                      <th className="text-left px-2.5 py-2 font-medium">Unité</th>
                      <th className="text-right px-2.5 py-2 font-medium">Réf.</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={`border-t border-border ${r.matched ? "" : "bg-amber-500/5"}`}>
                        <td className="px-2.5 py-1.5">
                          <input value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })}
                            className="w-full bg-transparent outline-none" />
                          {!r.matched && <span className="text-[10px] text-amber-400">alias inconnu</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <input type="number" step="any" value={r.value}
                            onChange={(e) => updateRow(i, { value: parseFloat(e.target.value) || 0 })}
                            className="w-20 bg-transparent outline-none text-right" />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input value={r.unit ?? ""} onChange={(e) => updateRow(i, { unit: e.target.value || null })}
                            className="w-20 bg-transparent outline-none" />
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-muted-foreground">
                          {r.refLow != null && r.refHigh != null ? `${r.refLow}–${r.refHigh}` : "—"}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-red-400" aria-label="Retirer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className="px-2.5 py-6 text-center text-muted-foreground">Aucun biomarqueur extrait — réessaye avec une photo plus nette.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-md hover:bg-secondary/50 transition">
                  Annuler
                </button>
                <button onClick={runInsert} disabled={mode === "inserting" || rows.length === 0}
                  className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                  {mode === "inserting" ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Insertion…</>) : (<><Check className="h-3.5 w-3.5" /> Insérer dans mon dossier</>)}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
