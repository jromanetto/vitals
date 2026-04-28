"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SkeletonRow } from "./skeleton";
import { HelpPill } from "./help-pill";
import { BODY_SYSTEMS, biomarkerSystem } from "@/lib/body-systems";
import { BIOMARKER_EXPLANATIONS } from "@/lib/biomarker-explanations";

function fmtValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  // Round to 4 significant figures to remove float garbage like 220.03230000000002
  const abs = Math.abs(v);
  let rounded: number;
  if (abs >= 100) rounded = Math.round(v);
  else if (abs >= 10) rounded = Math.round(v * 10) / 10;
  else if (abs >= 1) rounded = Math.round(v * 100) / 100;
  else rounded = Math.round(v * 1000) / 1000;
  return String(rounded);
}

type Row = {
  slug: string; name: string; category: string | null;
  value: number; unit: string | null;
  refLow: number | null; refHigh: number | null;
  date: number; status: "low" | "ok" | "high" | "unknown";
};

const STATUS_TIPS = {
  low: "Sous le range de référence du laboratoire",
  ok: "Dans le range de référence du laboratoire",
  high: "Au-dessus du range de référence du laboratoire",
  unknown: "Pas de range de référence dans le rapport source",
};

export function BiomarkerTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [openSystems, setOpenSystems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/biomarkers/latest").then((r) => r.json()).then((d) => setRows(d.rows ?? [])).catch(() => setRows([]));
  }, []);

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

  // Auto-open first 3 systems by default
  useEffect(() => {
    if (orderedSystems.length > 0 && Object.keys(openSystems).length === 0) {
      const init: Record<string, boolean> = {};
      orderedSystems.slice(0, 3).forEach((s) => { init[s.id] = true; });
      setOpenSystems(init);
    }
  }, [orderedSystems.length]); // eslint-disable-line

  return (
    <div className="space-y-4">
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
        const okCount = items.filter((r) => r.status === "ok").length;
        const altCount = items.filter((r) => r.status !== "ok" && r.status !== "unknown").length;
        const isOpen = !!openSystems[sys.id];

        return (
          <motion.section key={sys.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: sysIdx * 0.04 }}
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
              <div className="flex items-center gap-2 text-[10px] shrink-0">
                {okCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald/15 text-emerald border border-emerald/30">{okCount} ok</span>}
                {altCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">{altCount} hors range</span>}
                <span className="text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <span className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {isOpen && (
              <div className="border-t border-border">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/20">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Marqueur</th>
                      <th className="text-right px-4 py-2 font-medium">Valeur</th>
                      <th className="text-left px-4 py-2 font-medium">Réf.</th>
                      <th className="text-left px-4 py-2 font-medium">Statut</th>
                      <th className="text-right px-4 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.slug} className="border-t border-border/50 hover:bg-secondary/20 transition">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Link href={`/biomarkers/${r.slug}`} className="hover:text-emerald transition truncate">{r.name}</Link>
                            <HelpPill
                              title={r.name}
                              explanation={BIOMARKER_EXPLANATIONS[r.slug] ?? `${r.name} — biomarqueur sanguin. Clique pour demander à ton panel médical une explication détaillée et adaptée à ton profil.`}
                              question={`Mon ${r.name} est à ${fmtValue(r.value)} ${r.unit ?? ""}${r.refLow != null && r.refHigh != null ? ` (réf. ${r.refLow}–${r.refHigh})` : ""}. Statut: ${r.status}. Explique-moi ce que ça veut dire pour ma santé, ce qu'il faut surveiller et comment l'optimiser concrètement.`}
                              label={`Demander au panel médical à propos de ${r.name}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {fmtValue(r.value)} <span className="text-muted-foreground text-xs">{r.unit}</span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">
                          {r.refLow != null && r.refHigh != null ? `${r.refLow}–${r.refHigh}` : "—"}
                        </td>
                        <td className="px-4 py-2"><StatusBadge s={r.status} /></td>
                        <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                          {new Date(r.date).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.section>
        );
      })}
    </div>
  );
}

function StatusBadge({ s }: { s: Row["status"] }) {
  const map = {
    low: { label: "Bas", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    ok: { label: "Normal", cls: "bg-emerald/15 text-emerald border-emerald/30" },
    high: { label: "Haut", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    unknown: { label: "—", cls: "bg-secondary text-muted-foreground border-border" },
  } as const;
  const m = map[s];
  return (
    <span title={STATUS_TIPS[s]} className={`inline-flex px-2 py-0.5 rounded-full text-xs border cursor-help ${m.cls}`}>
      {m.label}
    </span>
  );
}
