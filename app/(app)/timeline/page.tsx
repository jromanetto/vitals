"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Clock,
  Activity,
  Dna,
  Pill,
  AlertCircle,
  Bell,
  FileText,
  X,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TimelineStrip } from "@/components/timeline-strip";
import { TimelineHeatmap } from "@/components/timeline-heatmap";
import type { TimelineEvent } from "@/app/api/timeline/route";

const RANGES: Array<{ label: string; ms: number; key: string }> = [
  { label: "1 mois", key: "1m", ms: 30 * 86400000 },
  { label: "6 mois", key: "6m", ms: 180 * 86400000 },
  { label: "1 an", key: "1y", ms: 365 * 86400000 },
  { label: "3 ans", key: "3y", ms: 3 * 365 * 86400000 },
  { label: "Tout", key: "all", ms: 20 * 365 * 86400000 },
];

const CATEGORY_FILTERS: Array<{ key: string; label: string; icon: React.ReactNode; kinds: TimelineEvent["kind"][] }> = [
  { key: "Bilans", label: "Bilans", icon: <Activity className="h-3.5 w-3.5" />, kinds: ["bilan-sanguin"] },
  { key: "ADN", label: "ADN", icon: <Dna className="h-3.5 w-3.5" />, kinds: ["dna-import"] },
  { key: "Suppléments", label: "Suppléments", icon: <Pill className="h-3.5 w-3.5" />, kinds: ["supp-start", "supp-end"] },
  { key: "Symptômes", label: "Symptômes", icon: <AlertCircle className="h-3.5 w-3.5" />, kinds: ["symptom"] },
  { key: "Rappels", label: "Rappels", icon: <Bell className="h-3.5 w-3.5" />, kinds: ["reminder"] },
  { key: "Documents", label: "Documents", icon: <FileText className="h-3.5 w-3.5" />, kinds: ["document"] },
];

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  "bilan-sanguin": "Bilan sanguin",
  "dna-import": "Import ADN",
  "supp-start": "Démarrage supplément",
  "supp-end": "Arrêt supplément",
  symptom: "Symptômes",
  reminder: "Rappel",
  document: "Document",
};

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

const PAGE_SIZE = 20;

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState("1y");
  const [activeCats, setActiveCats] = useState<Set<string>>(
    new Set(CATEGORY_FILTERS.map((c) => c.key))
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/timeline", { cache: "no-store" });
        if (!r.ok) throw new Error("fetch failed");
        const j = (await r.json()) as { events: TimelineEvent[] };
        if (alive) setEvents(j.events);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[2];

  const visibleKinds = useMemo(() => {
    const s = new Set<TimelineEvent["kind"]>();
    for (const f of CATEGORY_FILTERS) {
      if (activeCats.has(f.key)) for (const k of f.kinds) s.add(k);
    }
    return s;
  }, [activeCats]);

  const now = Date.now();
  const start = now - range.ms;

  const filtered = useMemo(() => {
    return events.filter((e) => visibleKinds.has(e.kind) && e.date >= start && e.date <= now);
  }, [events, visibleKinds, start, now]);

  // Reset paging when filters change
  useEffect(() => {
    setPage(1);
  }, [rangeKey, activeCats]);

  const grouped = useMemo(() => {
    const m = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const k = monthKey(e.date);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Flatten with month headers, then paginate
  type Row = { type: "month"; key: string } | { type: "event"; event: TimelineEvent };
  const allRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [k, evts] of grouped) {
      out.push({ type: "month", key: k });
      for (const e of evts) out.push({ type: "event", event: e });
    }
    return out;
  }, [grouped]);

  const visibleRows = allRows.slice(0, page * PAGE_SIZE + grouped.length); // include month headers in page math
  const eventCount = visibleRows.filter((r) => r.type === "event").length;
  const totalEvents = filtered.length;
  const hasMore = eventCount < totalEvents;

  function toggleCat(key: string) {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isEmpty = !loading && events.length === 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Timeline"
        description="Toute ton histoire santé sur une frise"
        icon={<Clock className="h-5 w-5 text-emerald" />}
      />

      {isEmpty ? (
        <EmptyState
          icon={<Clock />}
          title="Aucun événement encore"
          description="Importe tes bilans, ton ADN, tes documents et démarre des suppléments pour voir ta timeline prendre vie."
          actionLabel="Lancer l'ingestion"
          actionHref="/import"
        />
      ) : (
        <>
          {/* Toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
                Plage
              </span>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRangeKey(r.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition border ${
                    rangeKey === r.key
                      ? "bg-emerald text-white border-emerald"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
                Catégories
              </span>
              {CATEGORY_FILTERS.map((c) => {
                const active = activeCats.has(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleCat(c.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border ${
                      active
                        ? "bg-emerald/15 text-emerald border-emerald/40"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.icon}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Strip */}
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-2xl border border-border bg-card p-4 overflow-x-auto"
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-tight">Frise</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {filtered.length} événement{filtered.length > 1 ? "s" : ""}
              </span>
            </div>
            <TimelineStrip
              events={events.filter((e) => visibleKinds.has(e.kind))}
              rangeMs={range.ms}
              onSelect={setSelected}
            />
          </motion.section>

          {/* Heatmap */}
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-tight">Densité d'événements</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                1 carré = 1 jour
              </span>
            </div>
            <TimelineHeatmap
              events={events.filter((e) => visibleKinds.has(e.kind))}
              rangeMs={range.ms}
            />
          </motion.section>

          {/* Event list */}
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-2xl border border-border bg-card p-4 space-y-4"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Liste des événements</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {totalEvents} au total
              </span>
            </div>
            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Aucun événement avec ces filtres.
              </div>
            ) : (
              <div className="space-y-5">
                <AnimatePresence initial={false}>
                  {(() => {
                    let evtIdx = 0;
                    const limit = page * PAGE_SIZE;
                    const out: React.ReactNode[] = [];
                    for (const [mkey, evts] of grouped) {
                      if (evtIdx >= limit) break;
                      const slice: TimelineEvent[] = [];
                      for (const e of evts) {
                        if (evtIdx >= limit) break;
                        slice.push(e);
                        evtIdx++;
                      }
                      if (slice.length === 0) continue;
                      out.push(
                        <div key={mkey} className="space-y-2">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-card/80 backdrop-blur py-1 z-10">
                            {monthLabel(mkey)}
                          </div>
                          <ul className="space-y-1.5">
                            {slice.map((e) => (
                              <motion.li
                                key={e.id}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2 }}
                                className="group flex items-start gap-3 rounded-lg border border-transparent hover:border-border hover:bg-background/40 px-3 py-2 cursor-pointer transition"
                                onClick={() => setSelected(e)}
                              >
                                <div
                                  className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                                  style={{ background: e.color }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-sm font-medium truncate">{e.title}</span>
                                    {e.kind === "reminder" && e.done && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald/15 text-emerald">
                                        ✓ fait
                                      </span>
                                    )}
                                  </div>
                                  {e.subtitle && (
                                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                                      {e.subtitle}
                                    </div>
                                  )}
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
                                    {KIND_LABEL[e.kind]} ·{" "}
                                    {new Date(e.date).toLocaleDateString("fr-FR", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </div>
                                </div>
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return out;
                  })()}
                </AnimatePresence>
                {hasMore && (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-background/40 transition"
                    >
                      Charger plus ({totalEvents - eventCount} restants)
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.section>
        </>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-border bg-card p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: selected.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {KIND_LABEL[selected.kind]}
                    </div>
                    <div className="text-base font-semibold truncate">{selected.title}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Date
                  </div>
                  <div>
                    {new Date(selected.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
                {selected.subtitle && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Détails
                    </div>
                    <div>{selected.subtitle}</div>
                  </div>
                )}
                {selected.kind === "reminder" && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Statut
                    </div>
                    <div>{selected.done ? "✓ Fait" : "À faire"}</div>
                  </div>
                )}
              </div>
              {selected.href && (
                <Link
                  href={selected.href}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald text-white text-sm font-medium hover:brightness-110 transition"
                >
                  Voir <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
