"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

type Row = {
  slug: string; name: string; category: string | null;
  value: number; unit: string | null;
  refLow: number | null; refHigh: number | null;
  date: number; status: "low" | "ok" | "high" | "unknown";
};

export function BiomarkerTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/biomarkers/latest").then((r) => r.json()).then((d) => {
      setRows(d.rows ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()) || (r.category ?? "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-3">
      <input
        placeholder="Filtrer par nom ou catégorie…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full md:w-80 bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
      />
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Marqueur</th>
              <th className="text-left px-4 py-2.5 font-medium">Catégorie</th>
              <th className="text-right px-4 py-2.5 font-medium">Valeur</th>
              <th className="text-left px-4 py-2.5 font-medium">Réf.</th>
              <th className="text-left px-4 py-2.5 font-medium">Statut</th>
              <th className="text-right px-4 py-2.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                Aucun biomarqueur indexé. Lance l'ingestion depuis Profile pour parser tes PDFs.
              </td></tr>
            )}
            {filtered.map((r, i) => (
              <motion.tr
                key={r.slug}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.4) }}
                className="border-t border-border hover:bg-secondary/30 transition"
              >
                <td className="px-4 py-2.5">
                  <Link href={`/biomarkers/${r.slug}`} className="hover:text-emerald transition">{r.name}</Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.category ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono">{r.value} <span className="text-muted-foreground text-xs">{r.unit}</span></td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {r.refLow != null && r.refHigh != null ? `${r.refLow}–${r.refHigh}` : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge s={r.status} />
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                  {new Date(r.date).toLocaleDateString("fr-FR")}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
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
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${m.cls}`}>{m.label}</span>;
}
