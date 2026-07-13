"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Plus, X, Check, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";

type Reminder = {
  id: number;
  title: string;
  description: string | null;
  dueAt: number;
  category: string | null;
  done: boolean;
  createdAt: number;
  overdue: boolean;
  daysUntil: number;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "blood-test", label: "Prise de sang" },
  { value: "supplement-cure", label: "Cure supplément" },
  { value: "consultation", label: "Consultation" },
  { value: "other", label: "Autre" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

function formatDueLabel(daysUntil: number, dueAt: number): string {
  if (daysUntil === 0) return "aujourd'hui";
  if (daysUntil === 1) return "demain";
  if (daysUntil === -1) return "hier";
  if (daysUntil > 0 && daysUntil < 30) return `dans ${daysUntil} jours`;
  if (daysUntil < 0 && daysUntil > -30) return `il y a ${Math.abs(daysUntil)} jours`;
  return new Date(dueAt).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
}

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function defaultDueAtLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Derive overdue/daysUntil client-side from the raw reactive row (was the REST
// route's enrich()). `done` comes as 0/1 from Convex.
function enrichReminder(r: { id: number; title: string; description: string | null; dueAt: number; category: string | null; done: number; createdAt: number }): Reminder {
  const now = Date.now();
  return {
    id: r.id, title: r.title, description: r.description ?? null, dueAt: r.dueAt,
    category: r.category ?? null, done: !!r.done, createdAt: r.createdAt,
    overdue: !r.done && r.dueAt < now, daysUntil: Math.round((r.dueAt - now) / 86400000),
  };
}

export default function RemindersPage() {
  // Live reactive subscription (JWT-authed). REST writes below auto-update this.
  const live = useConvexQuery(api.reminders.listLive) as { rows: Parameters<typeof enrichReminder>[0][] } | undefined;
  const loading = live === undefined;
  const items = useMemo(() => (live?.rows ?? []).map(enrichReminder), [live]);
  const [title, setTitle] = useState("");
  const _searchParams = useSearchParams();
  const _titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (_searchParams.get("new") === "1") {
      setTimeout(() => { _titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); _titleRef.current?.focus(); }, 200);
    }
  }, [_searchParams]);
  const [description, setDescription] = useState("");
  const [dueAtLocal, setDueAtLocal] = useState(defaultDueAtLocal());
  const [category, setCategory] = useState<string>("blood-test");
  const [submitting, setSubmitting] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Writes go through the REST routes (server-bridge); the live subscription
  // above reflects them automatically — no manual reload / optimistic state.
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueAtLocal) return;
    setSubmitting(true);
    const dueAt = new Date(dueAtLocal).getTime();
    const r = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, dueAt, category }),
    });
    setSubmitting(false);
    if (r.ok) {
      setTitle("");
      setDescription("");
      setDueAtLocal(defaultDueAtLocal());
    }
  }

  async function toggle(id: number, done: boolean) {
    await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done }),
    });
  }

  async function remove(id: number) {
    await fetch(`/api/reminders?id=${id}`, { method: "DELETE" });
  }

  const groups = useMemo(() => {
    const overdue: Reminder[] = [];
    const today: Reminder[] = [];
    const week: Reminder[] = [];
    const later: Reminder[] = [];
    const done: Reminder[] = [];
    for (const it of items) {
      if (it.done) { done.push(it); continue; }
      if (it.overdue) { overdue.push(it); continue; }
      if (it.daysUntil <= 0) { today.push(it); continue; }
      if (it.daysUntil <= 7) { week.push(it); continue; }
      later.push(it);
    }
    return { overdue, today, week, later, done };
  }, [items]);

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Rappels"
        description="Suis tes prochaines prises de sang, cures et consultations."
        icon={<Bell className="h-5 w-5 text-emerald" />}
      />

      {/* Add form */}
      <motion.form
        onSubmit={add}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-xl border border-border bg-card p-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4 text-emerald" />
          Nouveau rappel
        </div>
        <Input
          ref={_titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre (ex: Bilan sanguin trimestriel)"
          required
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optionnel)"
          rows={2}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="datetime-local"
            value={dueAtLocal}
            onChange={(e) => setDueAtLocal(e.target.value)}
            required
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!title.trim()}
            loading={submitting}
          >
            {submitting ? "Ajout…" : "Ajouter"}
          </Button>
        </div>
      </motion.form>

      {loading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Aucun rappel pour le moment. Ajoute ton premier ci-dessus.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.overdue.length > 0 && (
            <Section title="En retard" tone="amber" items={groups.overdue} onToggle={toggle} onDelete={remove} />
          )}
          {groups.today.length > 0 && (
            <Section title="Aujourd'hui" items={groups.today} onToggle={toggle} onDelete={remove} />
          )}
          {groups.week.length > 0 && (
            <Section title="Cette semaine" items={groups.week} onToggle={toggle} onDelete={remove} />
          )}
          {groups.later.length > 0 && (
            <Section title="Plus tard" items={groups.later} onToggle={toggle} onDelete={remove} />
          )}
          {groups.done.length > 0 && (
            <div>
              <button
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-2 hover:text-foreground transition"
              >
                {showDone ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Terminés ({groups.done.length})
              </button>
              <AnimatePresence>
                {showDone && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {groups.done.map((it, i) => (
                      <ReminderCard key={it.id} item={it} index={i} onToggle={toggle} onDelete={remove} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  tone,
  onToggle,
  onDelete,
}: {
  title: string;
  items: Reminder[];
  tone?: "amber";
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <section>
      <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wider font-medium mb-2 ${tone === "amber" ? "text-amber-500" : "text-muted-foreground/70"}`}>
        {tone === "amber" && <AlertTriangle className="h-3 w-3" />}
        {title}
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <ReminderCard key={it.id} item={it} index={i} tone={tone} onToggle={onToggle} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

function ReminderCard({
  item,
  index,
  tone,
  onToggle,
  onDelete,
}: {
  item: Reminder;
  index: number;
  tone?: "amber";
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className={`rounded-xl border p-4 flex items-start gap-3 ${
        tone === "amber"
          ? "border-amber-500/30 bg-amber-500/5"
          : item.done
          ? "border-border bg-card/50 opacity-60"
          : "border-border bg-card"
      }`}
    >
      <button
        onClick={() => onToggle(item.id, !item.done)}
        aria-label={item.done ? "Marquer comme non fait" : "Marquer comme fait"}
        className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition ${
          item.done ? "bg-emerald border-emerald text-emerald-foreground" : "border-border hover:border-emerald"
        }`}
      >
        {item.done && <Check className="h-3 w-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.title}</h3>
          {item.category && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-secondary/60 border border-border text-muted-foreground">
              {CATEGORY_LABEL[item.category] ?? item.category}
            </span>
          )}
        </div>
        {item.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>}
        <div className="text-xs mt-1.5 flex items-center gap-2">
          <span className={tone === "amber" ? "text-amber-500 font-medium" : "text-muted-foreground"}>
            {formatDueLabel(item.daysUntil, item.dueAt)}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground/80">{formatFullDate(item.dueAt)}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        aria-label="Supprimer"
        className="text-muted-foreground/60 hover:text-foreground transition shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
