"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, ArrowRight, AlertTriangle } from "lucide-react";

type Reminder = {
  id: number;
  title: string;
  category: string | null;
  dueAt: number;
  done: boolean;
  overdue: boolean;
  daysUntil: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  "blood-test": "Prise de sang",
  "supplement-cure": "Cure",
  "consultation": "Consultation",
  "other": "Autre",
};

function formatDueLabel(daysUntil: number, dueAt: number): string {
  if (daysUntil === 0) return "aujourd'hui";
  if (daysUntil === 1) return "demain";
  if (daysUntil === -1) return "hier";
  if (daysUntil > 0 && daysUntil < 30) return `dans ${daysUntil} j`;
  if (daysUntil < 0 && daysUntil > -30) return `il y a ${Math.abs(daysUntil)} j`;
  return new Date(dueAt).toLocaleDateString("fr-FR", { month: "short", day: "numeric" });
}

export function RemindersWidget() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reminders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const upcoming = (d.rows ?? []).filter((r: Reminder) => !r.done).slice(0, 3);
        setItems(upcoming);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-secondary/60 border border-border flex items-center justify-center">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">Aucun rappel à venir</div>
            <div className="text-xs text-muted-foreground mt-0.5">Planifie ta prochaine prise de sang ou consultation.</div>
          </div>
        </div>
        <Link href="/reminders" className="text-xs text-emerald hover:underline inline-flex items-center gap-1">
          Ajouter <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      {items.map((it, i) => (
        <motion.div
          key={it.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
            it.overdue ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-secondary/20"
          }`}
        >
          <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${
            it.overdue ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-border bg-card text-muted-foreground"
          }`}>
            {it.overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{it.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className={it.overdue ? "text-amber-500" : ""}>{formatDueLabel(it.daysUntil, it.dueAt)}</span>
              {it.category && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span>{CATEGORY_LABEL[it.category] ?? it.category}</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ))}
      <div className="pt-1 flex justify-end">
        <Link href="/reminders" className="text-xs text-emerald hover:underline inline-flex items-center gap-1">
          Voir tous <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
