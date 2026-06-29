"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Plus, Loader2 } from "lucide-react";

type Row = { id: number; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number };

function toInputDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
}

export function MeasurementsEditor({ slug, name, defaultUnit, rows, readOnly = false }: { slug: string; name: string; defaultUnit: string | null; rows: Row[]; readOnly?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [editDate, setEditDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState("");
  const [addDate, setAddDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  function startEdit(r: Row) {
    setEditing(r.id); setEditVal(String(r.value)); setEditDate(toInputDate(r.date)); setError(null);
  }

  async function saveEdit(id: number) {
    const value = parseFloat(editVal.replace(",", "."));
    if (!Number.isFinite(value)) { setError("Valeur invalide"); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/biomarkers/measurement/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value, date: editDate }) });
      if (!r.ok) throw new Error((await r.json()).error || "Échec");
      setEditing(null); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function del(id: number) {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/biomarkers/measurement/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Échec");
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function add() {
    const value = parseFloat(addVal.replace(",", "."));
    if (!Number.isFinite(value)) { setError("Valeur invalide"); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/biomarkers/insert-extracted`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: addDate, source: "saisie-manuelle", biomarkers: [{ name, value, unit: defaultUnit }] }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Échec");
      setAdding(false); setAddVal(""); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const sorted = [...rows].sort((a, b) => b.date - a.date);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Mesures ({rows.length})</div>
        {!readOnly && !adding && (
          <button onClick={() => { setAdding(true); setError(null); }} className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:gap-1.5 transition-all">
            <Plus className="h-3.5 w-3.5" /> Ajouter une mesure
          </button>
        )}
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
          <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="bg-card border border-border rounded-md px-2 py-1.5 text-sm" />
          <input inputMode="decimal" placeholder="Valeur" value={addVal} onChange={(e) => setAddVal(e.target.value)} className="w-24 bg-card border border-border rounded-md px-2 py-1.5 text-sm" />
          <span className="text-xs text-muted-foreground">{defaultUnit}</span>
          <button onClick={add} disabled={busy} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald text-white text-sm font-medium disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Ajouter
          </button>
          <button onClick={() => { setAdding(false); setError(null); }} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {error && <div className="mb-2 text-xs text-red-400">{error}</div>}

      <div className="space-y-1">
        {sorted.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/30 transition text-sm group">
            {!readOnly && editing === r.id ? (
              <>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="bg-card border border-border rounded-md px-2 py-1 text-sm" />
                <input inputMode="decimal" value={editVal} onChange={(e) => setEditVal(e.target.value)} className="w-24 bg-card border border-border rounded-md px-2 py-1 text-sm" />
                <span className="text-xs text-muted-foreground">{r.unit}</span>
                <button onClick={() => saveEdit(r.id)} disabled={busy} className="ml-auto p-1.5 text-emerald hover:bg-emerald/10 rounded disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
                <button onClick={() => setEditing(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><X className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <span className="text-muted-foreground w-28 shrink-0">{fmtDate(r.date)}</span>
                <span className="font-mono text-foreground">{r.value} <span className="text-muted-foreground">{r.unit}</span></span>
                {!readOnly && (
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => startEdit(r)} className="p-1.5 text-muted-foreground hover:text-emerald rounded" aria-label="Corriger"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => del(r.id)} disabled={busy} className="p-1.5 text-muted-foreground hover:text-red-400 rounded disabled:opacity-50" aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
