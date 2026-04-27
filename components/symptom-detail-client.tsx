"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

type Log = { date: string; value: number; notes: string | null };
type Bm = { slug: string; name: string };
type Bp = { date: string; value: number };

export function SymptomDetailClient({ symptomKey, logs, biomarkers }: { symptomKey: string; logs: Log[]; biomarkers: Bm[] }) {
  const [overlaySlug, setOverlaySlug] = useState<string>("");
  const [overlay, setOverlay] = useState<Bp[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!overlaySlug) { setOverlay([]); return; }
    fetch(`/api/biomarkers/series?slug=${overlaySlug}`).then((r) => r.json()).then((d) => setOverlay(d.points ?? []));
  }, [overlaySlug]);

  // Combine into a unified series
  const combined: Array<{ date: string; symptom?: number; bm?: number }> = [];
  const map = new Map<string, { symptom?: number; bm?: number }>();
  for (const l of logs) {
    map.set(l.date, { ...map.get(l.date), symptom: l.value });
  }
  for (const b of overlay) {
    map.set(b.date, { ...map.get(b.date), bm: b.value });
  }
  for (const [date, vals] of [...map.entries()].sort()) combined.push({ date, ...vals });

  const symptomMax = Math.max(...logs.map((l) => l.value), 1);
  const bmMax = overlay.length ? Math.max(...overlay.map((o) => o.value)) : 1;
  const bmMin = overlay.length ? Math.min(...overlay.map((o) => o.value)) : 0;

  const filteredBms = biomarkers.filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">Superposer un biomarqueur</label>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher…"
                   className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div className="flex-1">
            <select value={overlaySlug} onChange={(e) => setOverlaySlug(e.target.value)}
                    className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="">— Aucun —</option>
              {filteredBms.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-border p-12 bg-card text-center text-sm text-muted-foreground">
          Aucune entrée pour ce symptôme. Logue depuis /symptoms.
        </div>
      ) : (
        <motion.section initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                       className="rounded-xl border border-border bg-card p-5">
          <div className="text-sm font-medium mb-3">
            {symptomKey} {overlaySlug && <span className="text-muted-foreground">+ {biomarkers.find((b) => b.slug === overlaySlug)?.name}</span>}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combined} margin={{ top: 10, right: 50, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
                <YAxis yAxisId="left" domain={[0, symptomMax]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />
                {overlaySlug && <YAxis yAxisId="right" orientation="right" domain={[bmMin * 0.9, bmMax * 1.1]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} stroke="hsl(var(--border))" />}
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="symptom" stroke="hsl(160 84% 39%)" strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls name={symptomKey} />
                {overlaySlug && (
                  <Line yAxisId="right" type="monotone" dataKey="bm" stroke="hsl(40 95% 60%)" strokeWidth={2} dot={{ r: 2.5 }} connectNulls strokeDasharray="4 4" name={biomarkers.find((b) => b.slug === overlaySlug)?.name} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald inline-block" /> Symptôme</span>
            {overlaySlug && <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block border-dashed" style={{ borderTop: "2px dashed rgb(251 191 36)" }} /> Biomarqueur</span>}
          </div>
        </motion.section>
      )}

      {logs.length > 0 && (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/30">
              <tr><th className="text-left px-4 py-2.5">Date</th><th className="text-right px-4 py-2.5">Valeur</th><th className="text-left px-4 py-2.5">Note</th></tr>
            </thead>
            <tbody>
              {logs.slice().reverse().slice(0, 30).map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{l.date}</td>
                  <td className="px-4 py-2 text-right font-mono">{l.value}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
