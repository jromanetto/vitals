"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitCompare, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { BODY_SYSTEMS, biomarkerSystem, SYSTEM_BY_ID } from "@/lib/body-systems";

type Row = {
  slug: string;
  name: string;
  category: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
  valueA: number | null;
  valueB: number | null;
  dateA: number | null;
  dateB: number | null;
};

type DateRow = { date: number; count: number };

type ApiResponse = { rows: Row[]; dates: DateRow[]; dateA: number | null; dateB: number | null };

const HIGHER_IS_BETTER = new Set<string>([
  "hdl", "vitamine-d-25-oh", "testosterone-totale", "testosterone-libre",
  "dhea-s", "index-omega-3", "apo-a1",
]);

function fmtValue(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 100) return Math.round(v).toString();
  if (abs >= 10) return (Math.round(v * 10) / 10).toString();
  if (abs >= 1) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
}

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function isoDate(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

/** Out of any range (lab or longevity)? */
function isOutOfRange(r: Row): boolean {
  const v = r.valueB ?? r.valueA;
  if (v == null) return false;
  if (r.longevityLow != null && r.longevityHigh != null) {
    if (v < r.longevityLow || v > r.longevityHigh) return true;
  } else if (r.refLow != null && r.refHigh != null) {
    if (v < r.refLow || v > r.refHigh) return true;
  }
  return false;
}

/** Distance to optimum band (longevity > optimal > lab). 0 if inside. */
function distance(v: number, r: Row): number {
  const lo = r.longevityLow ?? r.optimalLow ?? r.refLow;
  const hi = r.longevityHigh ?? r.optimalHigh ?? r.refHigh;
  if (lo == null || hi == null) return 0;
  if (v < lo) return lo - v;
  if (v > hi) return v - hi;
  return 0;
}

function direction(r: Row): "improving" | "degrading" | "flat" {
  if (r.valueA == null || r.valueB == null) return "flat";
  const diff = r.valueB - r.valueA;
  const refMag = Math.max(Math.abs(r.valueA), Math.abs(r.valueB), 1e-6);
  if (Math.abs(diff) / refMag < 0.02) return "flat";

  const lo = r.longevityLow ?? r.optimalLow ?? r.refLow;
  const hi = r.longevityHigh ?? r.optimalHigh ?? r.refHigh;
  if (lo != null && hi != null) {
    const dA = distance(r.valueA, r);
    const dB = distance(r.valueB, r);
    if (Math.abs(dB - dA) / refMag < 0.02) return "flat";
    return dB < dA ? "improving" : "degrading";
  }
  // No range: fall back to higher/lower-is-better heuristic.
  if (HIGHER_IS_BETTER.has(r.slug)) return diff > 0 ? "improving" : "degrading";
  return diff < 0 ? "improving" : "degrading";
}

export default function ComparePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateA, setDateA] = useState<number | null>(null);
  const [dateB, setDateB] = useState<number | null>(null);
  const [outOfRangeOnly, setOutOfRangeOnly] = useState(false);
  const [systemFilter, setSystemFilter] = useState<string>("all");

  // Initial load — server returns latest 2 dates by default.
  useEffect(() => {
    setLoading(true);
    fetch("/api/biomarkers/compare")
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setData(d);
        setDateA(d.dateA);
        setDateB(d.dateB);
      })
      .catch(() => setData({ rows: [], dates: [], dateA: null, dateB: null }))
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch when user changes a picker.
  useEffect(() => {
    if (!data) return;
    if (dateA === data.dateA && dateB === data.dateB) return;
    if (dateA == null && dateB == null) return;
    const params = new URLSearchParams();
    if (dateA != null) params.set("dateA", String(dateA));
    if (dateB != null) params.set("dateB", String(dateB));
    fetch(`/api/biomarkers/compare?${params.toString()}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setData((prev) => prev ? { ...prev, rows: d.rows, dateA: d.dateA, dateB: d.dateB } : d))
      .catch(() => {});
  }, [dateA, dateB]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (outOfRangeOnly) rows = rows.filter(isOutOfRange);
    if (systemFilter !== "all") rows = rows.filter((r) => biomarkerSystem(r.slug) === systemFilter);
    return rows;
  }, [data, outOfRangeOnly, systemFilter]);

  const grouped = useMemo(() => {
    const g: Record<string, Row[]> = {};
    for (const r of filtered) (g[biomarkerSystem(r.slug)] ??= []).push(r);
    return g;
  }, [filtered]);

  const orderedSystems = BODY_SYSTEMS.filter((s) => grouped[s.id]?.length > 0);

  const counts = useMemo(() => {
    let improving = 0, degrading = 0, flat = 0;
    for (const r of filtered) {
      const d = direction(r);
      if (d === "improving") improving++;
      else if (d === "degrading") degrading++;
      else flat++;
    }
    return { improving, degrading, flat };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <Link href="/biomarkers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux biomarqueurs
      </Link>

      <PageHeader
        title="Comparer deux bilans"
        description="Choisis deux dates de bilans pour comparer chaque biomarqueur côte à côte. Les flèches indiquent si tu te rapproches de la cible longévité (vert) ou si tu t'en éloignes (rouge)."
        icon={<GitCompare className="h-5 w-5 text-emerald" />}
      />

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Bilan A</label>
            <select
              value={dateA ?? ""}
              onChange={(e) => setDateA(e.target.value ? Number(e.target.value) : null)}
              className="bg-secondary/40 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary transition"
            >
              {data?.dates.map((d) => (
                <option key={d.date} value={d.date}>{fmtDate(d.date)} ({d.count})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Bilan B</label>
            <select
              value={dateB ?? ""}
              onChange={(e) => setDateB(e.target.value ? Number(e.target.value) : null)}
              className="bg-secondary/40 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary transition"
            >
              {data?.dates.map((d) => (
                <option key={d.date} value={d.date}>{fmtDate(d.date)} ({d.count})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={outOfRangeOnly} onChange={(e) => setOutOfRangeOnly(e.target.checked)} className="accent-emerald" />
              <span className="text-muted-foreground">Hors plage uniquement</span>
            </label>
            <select
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="bg-secondary/40 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary transition"
            >
              <option value="all">Tous les systèmes</option>
              {BODY_SYSTEMS.map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider mt-3">
            <span className="px-2 py-0.5 rounded-full border border-emerald/30 bg-emerald/10 text-emerald">{counts.improving} en progrès</span>
            <span className="px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400">{counts.degrading} en régression</span>
            <span className="px-2 py-0.5 rounded-full border border-border bg-secondary/30 text-muted-foreground">{counts.flat} stables</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Chargement…
        </div>
      )}

      {!loading && (!data || data.dates.length < 2) && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Il faut au moins 2 bilans pour comparer. Importe un autre PDF via Profile.
        </div>
      )}

      {!loading && filtered.length === 0 && data && data.dates.length >= 2 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Aucun biomarqueur ne correspond à ce filtre.
        </div>
      )}

      {!loading && orderedSystems.map((sys, sysIdx) => {
        const items = grouped[sys.id];
        return (
          <motion.section
            key={sys.id}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(sysIdx * 0.04, 0.4) }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/20">
              <span className="text-xl">{sys.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{sys.label}</div>
                <div className="text-[11px] text-muted-foreground">{SYSTEM_BY_ID[sys.id].description}</div>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{items.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <th className="text-left px-4 py-2 font-normal">Biomarqueur</th>
                    <th className="text-right px-3 py-2 font-normal">{fmtDate(dateA)}</th>
                    <th className="text-right px-3 py-2 font-normal">{fmtDate(dateB)}</th>
                    <th className="text-right px-3 py-2 font-normal">Δ abs.</th>
                    <th className="text-right px-3 py-2 font-normal">Δ %</th>
                    <th className="text-center px-3 py-2 font-normal">Sens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((r) => {
                    const dir = direction(r);
                    const dirCls =
                      dir === "improving" ? "text-emerald" :
                      dir === "degrading" ? "text-red-400" :
                      "text-muted-foreground";
                    const rowBg =
                      dir === "improving" ? "bg-emerald/5 hover:bg-emerald/10" :
                      dir === "degrading" ? "bg-red-500/5 hover:bg-red-500/10" :
                      "hover:bg-secondary/20";
                    const deltaAbs = (r.valueA != null && r.valueB != null) ? r.valueB - r.valueA : null;
                    const deltaPct = (r.valueA != null && r.valueB != null && r.valueA !== 0) ? ((r.valueB - r.valueA) / Math.abs(r.valueA)) * 100 : null;
                    const Icon = dir === "improving" ? ArrowDownRight : dir === "degrading" ? ArrowUpRight : Minus;

                    return (
                      <tr key={r.slug} className={`transition ${rowBg}`}>
                        <td className="px-4 py-3">
                          <Link href={`/biomarkers/${r.slug}`} className="hover:text-emerald transition">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {r.refLow != null && r.refHigh != null && <>réf. {r.refLow}–{r.refHigh}{r.unit ? ` ${r.unit}` : ""}</>}
                              {r.longevityLow != null && r.longevityHigh != null && (
                                <span className="ml-2 text-emerald/80">cible {r.longevityLow}–{r.longevityHigh}</span>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
                          {fmtValue(r.valueA)}
                          {r.dateA && r.dateA !== dateA && (
                            <div className="text-[9px] italic">≈ {fmtDate(r.dateA)}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {fmtValue(r.valueB)}
                          {r.dateB && r.dateB !== dateB && (
                            <div className="text-[9px] italic text-muted-foreground">≈ {fmtDate(r.dateB)}</div>
                          )}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono tabular-nums ${dirCls}`}>
                          {deltaAbs != null ? `${deltaAbs > 0 ? "+" : ""}${fmtValue(deltaAbs)}` : "—"}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono tabular-nums ${dirCls}`}>
                          {deltaPct != null ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${dir === "improving" ? "bg-emerald/15" : dir === "degrading" ? "bg-red-500/15" : "bg-secondary/40"}`}>
                            <Icon className={`h-3.5 w-3.5 ${dirCls}`} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
