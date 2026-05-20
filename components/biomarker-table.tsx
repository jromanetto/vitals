"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SkeletonRow } from "./skeleton";
import { HelpPill } from "./help-pill";
import { BiomarkerStatusBar } from "./biomarker-status-bar";
import { InlineSparkline, type SparkPoint } from "./inline-sparkline";
import { BODY_SYSTEMS, biomarkerSystem } from "@/lib/body-systems";
import { BIOMARKER_EXPLANATIONS } from "@/lib/biomarker-explanations";

type Status = "optimal" | "normal" | "slightly-off" | "attention" | "unknown";

type Row = {
  slug: string; name: string; category: string | null;
  value: number; unit: string | null;
  refLow: number | null; refHigh: number | null;
  optimalLow: number | null; optimalHigh: number | null;
  longevityLow: number | null; longevityHigh: number | null;
  date: number; status: Status;
};

const STATUS_CFG: Record<Status, { label: string; cls: string }> = {
  optimal:        { label: "Optimal",     cls: "text-emerald" },
  normal:         { label: "Normal",      cls: "text-sky-400" },
  "slightly-off": { label: "Légèrement hors plage", cls: "text-amber-400" },
  attention:      { label: "À surveiller", cls: "text-red-400" },
  unknown:        { label: "—",            cls: "text-muted-foreground" },
};

// Slugs where a higher value is the desired direction (when no optimum band is provided).
const HIGHER_IS_BETTER = new Set<string>([
  "hdl", "vitamine-d-25-oh", "testosterone-totale", "testosterone-libre",
  "dhea-s", "index-omega-3", "apo-a1",
]);

function fmtValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  let rounded: number;
  if (abs >= 100) rounded = Math.round(v);
  else if (abs >= 10) rounded = Math.round(v * 10) / 10;
  else if (abs >= 1) rounded = Math.round(v * 100) / 100;
  else rounded = Math.round(v * 1000) / 1000;
  return String(rounded);
}

function fmtRef(lo: number | null, hi: number | null): string {
  if (lo == null && hi == null) return "—";
  if (lo == null) return `< ${fmtValue(hi!)}`;
  if (hi == null) return `> ${fmtValue(lo)}`;
  return `${fmtValue(lo)}–${fmtValue(hi)}`;
}

export function BiomarkerTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [series, setSeries] = useState<Record<string, SparkPoint[]>>({});
  const [filter, setFilter] = useState("");
  const [openSystems, setOpenSystems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/biomarkers/latest").then((r) => r.json()).then((d) => setRows(d.rows ?? [])).catch(() => setRows([]));
  }, []);

  // Bulk-fetch sparkline series once we know the full slug list.
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    const slugs = rows.map((r) => r.slug);
    const params = new URLSearchParams({ slugs: slugs.join(",") });
    fetch(`/api/biomarkers/series?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setSeries(d.series ?? {}))
      .catch(() => setSeries({}));
  }, [rows]);

  const loading = rows === null;
  const filtered = (rows ?? []).filter(
    (r) => r.name.toLowerCase().includes(filter.toLowerCase()) || (r.category ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  const grouped = useMemo(() => {
    const g: Record<string, Row[]> = {};
    for (const r of filtered) {
      const sys = biomarkerSystem(r.slug);
      (g[sys] ??= []).push(r);
    }
    return g;
  }, [filtered]);

  const orderedSystems = BODY_SYSTEMS.filter((s) => grouped[s.id]?.length > 0);

  const totals = useMemo(() => {
    const t = { optimal: 0, normal: 0, "slightly-off": 0, attention: 0, unknown: 0 };
    for (const r of filtered) t[r.status]++;
    return t;
  }, [filtered]);

  const latestDate = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return Math.max(...rows.map((r) => r.date));
  }, [rows]);
  const SIX_MONTHS_MS = 180 * 86400000;
  function freshness(date: number): "current" | "stale" {
    if (!latestDate) return "current";
    return latestDate - date > SIX_MONTHS_MS ? "stale" : "current";
  }

  useEffect(() => {
    if (orderedSystems.length > 0 && Object.keys(openSystems).length === 0) {
      const init: Record<string, boolean> = {};
      orderedSystems.slice(0, 4).forEach((s) => { init[s.id] = true; });
      setOpenSystems(init);
    }
  }, [orderedSystems.length]); // eslint-disable-line

  return (
    <div className="space-y-4">
      {!loading && filtered.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 text-[10px] uppercase tracking-wider">
          {totals.optimal > 0 && <span className="px-2 py-1 rounded-full border border-emerald/30 bg-emerald/10 text-emerald">{totals.optimal} optimal</span>}
          {totals.normal > 0 && <span className="px-2 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400">{totals.normal} normal</span>}
          {totals["slightly-off"] > 0 && <span className="px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">{totals["slightly-off"]} légèrement hors</span>}
          {totals.attention > 0 && <span className="px-2 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400">{totals.attention} à surveiller</span>}
          {totals.unknown > 0 && <span className="px-2 py-1 rounded-full border border-border bg-secondary/30 text-muted-foreground">{totals.unknown} sans réf.</span>}
          <span className="ml-1 text-muted-foreground normal-case">· Optimal = plage longévité atteinte</span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          placeholder="Filtrer par nom ou catégorie…" value={filter} onChange={(e) => setFilter(e.target.value)}
          className="flex-1 md:flex-none md:w-80 bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
        />
        <button
          onClick={() => {
            const allOpen = orderedSystems.every((s) => openSystems[s.id]);
            const next: Record<string, boolean> = {};
            orderedSystems.forEach((s) => { next[s.id] = !allOpen; });
            setOpenSystems(next);
          }}
          className="text-xs px-3 py-2 rounded-md border border-border bg-secondary/30 hover:bg-secondary/60 text-muted-foreground transition"
        >
          {orderedSystems.every((s) => openSystems[s.id]) ? "Tout replier" : "Tout déplier"}
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Aucun biomarqueur indexé. Lance l'ingestion via Profile pour parser tes PDFs.
        </div>
      )}

      {!loading && orderedSystems.map((sys, sysIdx) => {
        const items = grouped[sys.id];
        const optCount = items.filter((r) => r.status === "optimal").length;
        const altCount = items.filter((r) => r.status === "slightly-off" || r.status === "attention").length;
        const isOpen = !!openSystems[sys.id];

        return (
          <motion.section key={sys.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(sysIdx * 0.04, 0.4) }}
                          className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setOpenSystems((s) => ({ ...s, [sys.id]: !s[sys.id] }))}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition text-left"
            >
              <span className="text-xl shrink-0">{sys.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{sys.label}</div>
                <div className="text-[11px] text-muted-foreground">{sys.description}</div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                {optCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald/15 text-emerald border border-emerald/30">{optCount} optimal</span>}
                {altCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">{altCount} hors plage</span>}
                <span className="text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <span className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {isOpen && (
              <div className="border-t border-border divide-y divide-border/50">
                {items.map((r) => {
                  const cfg = STATUS_CFG[r.status];
                  const fresh = freshness(r.date);
                  const pts = series[r.slug] ?? [];
                  return (
                    <div key={r.slug} className="px-4 py-4 hover:bg-secondary/20 transition">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:gap-4 items-start">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/biomarkers/${r.slug}`} className="text-sm font-medium hover:text-emerald transition">{r.name}</Link>
                            <HelpPill
                              title={r.name}
                              explanation={BIOMARKER_EXPLANATIONS[r.slug] ?? `${r.name} — biomarqueur sanguin. Clique pour demander à ton équipe médicale une explication détaillée et adaptée à ton profil.`}
                              question={`Mon ${r.name} est à ${fmtValue(r.value)} ${r.unit ?? ""}${r.refLow != null && r.refHigh != null ? ` (réf. labo ${r.refLow}–${r.refHigh})` : ""}${r.longevityLow != null && r.longevityHigh != null ? ` (cible longévité ${r.longevityLow}–${r.longevityHigh})` : ""}. Statut: ${cfg.label}. Explique-moi ce que ça veut dire pour ma santé, et comment l'optimiser concrètement (nutrition, supplémentation, lifestyle).`}
                            />
                            {fresh === "stale" && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-muted-foreground/30 bg-secondary/40 text-muted-foreground" title={`Donnée ancienne (${new Date(r.date).toLocaleDateString("fr-FR")}). Pour comparer, refais ce dosage.`}>
                                ⏱ ancienne
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] uppercase tracking-wider ${cfg.cls}`}>{cfg.label}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">·</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(r.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2 flex-wrap">
                            {r.refLow != null && r.refHigh != null && (
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-3 rounded-sm bg-sky-500/40" />
                                <span>Labo <span className="font-mono tabular-nums">{fmtRef(r.refLow, r.refHigh)}</span></span>
                              </span>
                            )}
                            {r.longevityLow != null && r.longevityHigh != null && (
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-3 rounded-sm bg-emerald/60" />
                                <span>Longévité <span className="font-mono tabular-nums">{fmtRef(r.longevityLow, r.longevityHigh)}</span></span>
                              </span>
                            )}
                            {r.unit && <span className="text-muted-foreground/70">{r.unit}</span>}
                          </div>

                          <BiomarkerStatusBar
                            value={r.value}
                            refLow={r.refLow} refHigh={r.refHigh}
                            longevityLow={r.longevityLow} longevityHigh={r.longevityHigh}
                            status={r.status}
                          />
                        </div>
                        {/* Inline sparkline (last 6 points). Hidden on smallest screens to save horizontal space. */}
                        <div className="hidden md:flex items-center justify-center self-center">
                          <InlineSparkline
                            points={pts}
                            width={60}
                            height={24}
                            optimalLow={r.longevityLow ?? r.optimalLow}
                            optimalHigh={r.longevityHigh ?? r.optimalHigh}
                            unit={r.unit}
                            higherIsBetter={HIGHER_IS_BETTER.has(r.slug)}
                          />
                        </div>
                        <div className="text-right min-w-[6rem] shrink-0">
                          <div className={`text-2xl font-semibold tabular-nums leading-none ${cfg.cls}`}>{fmtValue(r.value)}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{r.unit}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>
        );
      })}
    </div>
  );
}
