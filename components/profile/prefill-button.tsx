"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Loader2, Check, X } from "lucide-react";

type PrefillResp = {
  patch: Record<string, unknown>;
  reasons: Record<string, string>;
};

const LABELS: Record<string, string> = {
  screeningHistory: "Suivi médical (dates des derniers examens)",
  wearables: "Wearables possédés",
  restingHr: "FC repos",
  hrv: "HRV moyenne",
  sleepHours: "Sommeil moyen (h/nuit)",
  dietType: "Type d'alimentation",
  allergiesFood: "Allergies alimentaires",
  foodsAvoided: "Aliments évités",
  supplements: "Compléments alimentaires",
  activeSymptoms: "Symptômes actifs",
  primaryGoals: "Objectifs santé prioritaires",
  weight: "Poids",
  bodyFat: "% masse grasse",
  vo2max: "VO2max",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") {
    // screeningHistory shape: { id: { lastDate } }
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return "—";
    return entries
      .map(([k, val]) => {
        if (val && typeof val === "object" && "lastDate" in val) {
          return `${k} → ${(val as { lastDate?: string }).lastDate ?? "?"}`;
        }
        return `${k}: ${val}`;
      })
      .join(" ; ");
  }
  return String(v);
}

export function PrefillButton() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PrefillResp | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function fetchPrefill() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const r = await fetch("/api/profile/prefill");
      if (!r.ok) {
        setError(`Erreur ${r.status}`);
        return;
      }
      const d = (await r.json()) as PrefillResp;
      setData(d);
      // Default: all proposed fields selected.
      setSelected(Object.fromEntries(Object.keys(d.patch).map((k) => [k, true])));
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!data) return;
    const accepted = Object.keys(selected).filter((k) => selected[k]);
    if (accepted.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const r = await fetch("/api/profile/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
      const out = (await r.json()) as { applied?: number; error?: string };
      if (!r.ok) {
        setError(out.error ?? `Erreur ${r.status}`);
        return;
      }
      setDone(out.applied ?? accepted.length);
      // Reload the wizard data — simplest is full reload.
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      setError("Erreur réseau");
    } finally {
      setApplying(false);
    }
  }

  function close() {
    setData(null);
    setSelected({});
    setError(null);
    setDone(null);
  }

  const proposedKeys = data ? Object.keys(data.patch) : [];
  const acceptedCount = Object.values(selected).filter(Boolean).length;

  // Auto-open after the welcome flow lands at /profile?prefill=1.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("prefill") === "1") {
      // Strip the param so a refresh doesn't re-open the modal.
      url.searchParams.delete("prefill");
      window.history.replaceState({}, "", url.toString());
      // Defer one tick so the wizard is mounted before fetching.
      setTimeout(() => { fetchPrefill(); }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={fetchPrefill}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald/10 border border-emerald/30 text-xs text-emerald hover:bg-emerald/20 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        Pré-remplir depuis mes données
      </button>

      <AnimatePresence>
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="text-lg font-medium tracking-tight">Pré-remplissage automatique</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {proposedKeys.length} champ(s) déductibles depuis tes données existantes. Décoche ce
                    que tu ne veux pas appliquer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="h-8 w-8 rounded-md hover:bg-secondary/50 flex items-center justify-center"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-2">
                {proposedKeys.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Rien à pré-remplir — tes données existantes ne donnent pas d&apos;information nouvelle pour le profil.
                  </p>
                )}
                {proposedKeys.map((k) => (
                  <label
                    key={k}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected[k] ?? false}
                      onChange={(e) => setSelected({ ...selected, [k]: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-emerald flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{LABELS[k] ?? k}</p>
                      <p className="text-xs text-emerald mt-0.5 break-words">
                        Proposé : {formatValue(data.patch[k])}
                      </p>
                      {data.reasons[k] && (
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                          {data.reasons[k]}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 p-5 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  {error ? (
                    <span className="text-red-500">{error}</span>
                  ) : done !== null ? (
                    <span className="text-emerald flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> {done} champ(s) appliqué(s). Rechargement…
                    </span>
                  ) : (
                    `${acceptedCount} sélectionné(s)`
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={applying || acceptedCount === 0 || done !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald text-emerald-foreground hover:bg-emerald/90 transition text-xs font-medium disabled:opacity-50"
                  >
                    {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Appliquer ({acceptedCount})
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
