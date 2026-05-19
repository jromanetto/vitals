"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  Activity,
  Stethoscope,
  Pill,
  Microscope,
  Check,
  Clock,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";

type TodoItem = {
  id: string;
  kind: "red-flag" | "screening" | "device" | "specialist" | "supplement" | "lab-test";
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  category?: string;
  ctaLabel: string;
  ctaHref?: string;
  externalUrl?: string;
};

const KIND_ICON: Record<TodoItem["kind"], React.ComponentType<{ className?: string }>> = {
  "red-flag": AlertTriangle,
  screening: Calendar,
  device: Activity,
  specialist: Stethoscope,
  supplement: Pill,
  "lab-test": Microscope,
};

const KIND_LABEL: Record<TodoItem["kind"], string> = {
  "red-flag": "Urgent",
  screening: "Examen",
  device: "Device",
  specialist: "Spécialiste",
  supplement: "Complément",
  "lab-test": "Analyse",
};

const PRIORITY_TONE: Record<TodoItem["priority"], string> = {
  high: "border-red-500/40 bg-red-500/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-border bg-card",
};

const PRIORITY_BADGE: Record<TodoItem["priority"], string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/40",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  low: "bg-secondary/40 text-muted-foreground border-border",
};

type Filter = "all" | "urgent" | "screening" | "device" | "specialist" | "supplement";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "urgent", label: "Urgent" },
  { id: "screening", label: "Examens" },
  { id: "device", label: "Devices" },
  { id: "specialist", label: "Spécialistes" },
  { id: "supplement", label: "Compléments" },
];

export function TodoClient() {
  const [items, setItems] = useState<TodoItem[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/todo");
      if (!r.ok) {
        setError(`Erreur ${r.status}`);
        return;
      }
      const d = await r.json();
      setItems(d.items ?? []);
      setDemo(!!d.demo);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: "done" | "snoozed" | "dismissed", days?: number) {
    if (demo) return;
    setPending((p) => ({ ...p, [id]: true }));
    try {
      await fetch("/api/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, days }),
      });
      // Remove the item optimistically.
      setItems((cur) => (cur ?? []).filter((it) => it.id !== id));
    } catch {
      // ignore
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    }
  }

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "all") return items;
    if (filter === "urgent") return items.filter((i) => i.priority === "high" || i.kind === "red-flag");
    return items.filter((i) => i.kind === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, urgent: 0, screening: 0, device: 0, specialist: 0, supplement: 0 };
    for (const it of items ?? []) {
      c.all++;
      if (it.priority === "high" || it.kind === "red-flag") c.urgent++;
      if (it.kind === "screening") c.screening++;
      if (it.kind === "device") c.device++;
      if (it.kind === "specialist") c.specialist++;
      if (it.kind === "supplement") c.supplement++;
    }
    return c;
  }, [items]);

  if (items === null) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-emerald" />
        <span className="text-sm">Calcul de tes recommandations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-8 text-center">
        <Check className="h-8 w-8 text-emerald mx-auto mb-2" />
        <p className="text-sm font-medium">Tout est à jour ✓</p>
        <p className="text-xs text-muted-foreground mt-1">
          Aucun examen en retard, aucune action urgente. Reviens dans quelques semaines.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const c = counts[f.id];
          if (c === 0 && f.id !== "all") return null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition flex items-center gap-1.5 ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary font-medium"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="text-[10px] tabular-nums">{c}</span>
            </button>
          );
        })}
      </div>

      {demo && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          Mode démo — tu peux explorer mais pas marquer les actions comme faites.
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {filtered.map((it, i) => {
            const Icon = KIND_ICON[it.kind];
            const isPending = !!pending[it.id];
            return (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 80 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className={`rounded-xl border p-4 ${PRIORITY_TONE[it.priority]} ${isPending ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-emerald" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRIORITY_BADGE[it.priority]}`}>
                        {KIND_LABEL[it.kind]}
                      </span>
                      <h3 className="text-sm font-medium tracking-tight flex-1 min-w-0">{it.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{it.rationale}</p>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {it.externalUrl ? (
                        <a
                          href={it.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald/10 border border-emerald/30 text-xs text-emerald hover:bg-emerald/20 transition"
                        >
                          {it.ctaLabel} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : it.ctaHref ? (
                        <Link
                          href={it.ctaHref}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald/10 border border-emerald/30 text-xs text-emerald hover:bg-emerald/20 transition"
                        >
                          {it.ctaLabel}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => updateStatus(it.id, "done")}
                        disabled={demo || isPending}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-border bg-card hover:bg-secondary/40 transition text-xs disabled:opacity-50"
                        title="Marquer comme fait"
                      >
                        <Check className="h-3 w-3" /> Fait
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(it.id, "snoozed", 30)}
                        disabled={demo || isPending}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-border bg-card hover:bg-secondary/40 transition text-xs disabled:opacity-50"
                        title="Reporter 30j"
                      >
                        <Clock className="h-3 w-3" /> +30j
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(it.id, "dismissed")}
                        disabled={demo || isPending}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-border bg-card hover:bg-secondary/40 transition text-xs text-muted-foreground disabled:opacity-50"
                        title="Ne plus afficher"
                      >
                        <X className="h-3 w-3" /> Ignorer
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-4 leading-relaxed">
        Recommandations générées automatiquement par recoupement de tes symptômes, biomarqueurs, ADN, antécédents
        familiaux, âge et sexe. Ne remplace pas un avis médical. Discute toujours avec ton médecin avant un examen
        ou un device.
      </p>
    </div>
  );
}
