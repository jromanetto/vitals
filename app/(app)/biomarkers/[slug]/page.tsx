import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { BiomarkerChart } from "@/components/biomarker-chart";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Series = { date: number; value: number; source: string | null }[];

async function loadHistory(slug: string) {
  ensureSchema();
  const d = db();
  const rows = d.$client.prepare(`
    SELECT name, category, value, unit, ref_low as refLow, ref_high as refHigh, date, source
    FROM biomarker WHERE slug = ? ORDER BY date ASC
  `).all(slug) as Array<{ name: string; category: string | null; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number; source: string | null }>;
  return rows;
}

export default async function BiomarkerDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await loadHistory(slug);
  const meta = rows[0];
  const md = META_BY_SLUG[slug];
  const series: Series = rows.map((r) => ({ date: r.date, value: r.value, source: r.source }));
  const latest = rows[rows.length - 1];
  const first = rows[0];
  const change = latest && first && latest !== first ? ((latest.value - first.value) / first.value) * 100 : 0;

  function statusBadge() {
    if (!latest) return null;
    if (md?.longevityLow != null && md.longevityHigh != null) {
      if (latest.value >= md.longevityLow && latest.value <= md.longevityHigh) return { label: "Cible longévité atteinte", color: "bg-emerald/15 text-emerald border-emerald/30" };
    }
    if (md?.optimalLow != null && md.optimalHigh != null) {
      if (latest.value >= md.optimalLow && latest.value <= md.optimalHigh) return { label: "Optimal", color: "bg-emerald/15 text-emerald border-emerald/30" };
    }
    if (meta?.refLow != null && meta?.refHigh != null) {
      if (latest.value >= meta.refLow && latest.value <= meta.refHigh) return { label: "Dans range labo", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
      if (latest.value < meta.refLow) return { label: "Sous le range", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
      return { label: "Au-dessus du range", color: "bg-red-500/15 text-red-400 border-red-500/30" };
    }
    return null;
  }
  const sb = statusBadge();

  return (
    <div className="space-y-6">
      <Link href="/biomarkers" className="text-sm text-muted-foreground hover:text-foreground">← Tous les biomarkers</Link>
      {!meta && (
        <div className="rounded-xl border border-border p-8 bg-card text-muted-foreground">Aucune donnée pour ce marqueur.</div>
      )}
      {meta && (
        <>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{meta.category ?? "Biomarqueur"}</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">{meta.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Dernière valeur : <span className="text-foreground font-mono">{latest.value} {latest.unit}</span></span>
              {sb && <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${sb.color}`}>{sb.label}</span>}
              {rows.length > 1 && <span>Évolution: <span className={change > 0 ? "text-amber-400" : "text-emerald"}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span> sur {rows.length} mesures</span>}
            </div>
          </div>

          {/* Reference range pills */}
          {md && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Cibles de référence</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {meta.refLow != null && meta.refHigh != null && (
                  <div className="p-3 rounded-md bg-secondary/30 border border-border/40">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Range labo</div>
                    <div className="font-mono text-sm mt-1">{meta.refLow} – {meta.refHigh} {md.unit}</div>
                  </div>
                )}
                {md.optimalLow != null && md.optimalHigh != null && (
                  <div className="p-3 rounded-md bg-emerald/10 border border-emerald/30">
                    <div className="text-[10px] uppercase tracking-widest text-emerald">Optimal</div>
                    <div className="font-mono text-sm mt-1">{md.optimalLow} – {md.optimalHigh} {md.unit}</div>
                  </div>
                )}
                {md.longevityLow != null && md.longevityHigh != null && (
                  <div className="p-3 rounded-md bg-emerald/20 border border-emerald/50">
                    <div className="text-[10px] uppercase tracking-widest text-emerald">Cible longévité</div>
                    <div className="font-mono text-sm mt-1">{md.longevityLow} – {md.longevityHigh} {md.unit}</div>
                  </div>
                )}
              </div>
              {md.whyMatters && <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{md.whyMatters}</p>}
              {md.related.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground">Voir aussi :</span>
                  {md.related.map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-secondary/40 border border-border">{r}</span>)}
                </div>
              )}
            </div>
          )}

          <BiomarkerChart
            series={series}
            refLow={meta.refLow} refHigh={meta.refHigh}
            optimalLow={md?.optimalLow} optimalHigh={md?.optimalHigh}
            longevityLow={md?.longevityLow} longevityHigh={md?.longevityHigh}
            unit={meta.unit ?? md?.unit ?? ""}
          />
        </>
      )}
    </div>
  );
}
