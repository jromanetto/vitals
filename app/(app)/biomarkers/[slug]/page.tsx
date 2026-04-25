import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { BiomarkerChart } from "@/components/biomarker-chart";
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
  const series: Series = rows.map((r) => ({ date: r.date, value: r.value, source: r.source }));
  const latest = rows[rows.length - 1];

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
            <div className="text-sm text-muted-foreground mt-2">
              Dernière valeur : <span className="text-foreground font-mono">{latest.value} {latest.unit}</span>
              {meta.refLow != null && meta.refHigh != null && <span> · ref. {meta.refLow}–{meta.refHigh}</span>}
              · {rows.length} mesures
            </div>
          </div>
          <BiomarkerChart series={series} refLow={meta.refLow} refHigh={meta.refHigh} unit={meta.unit ?? ""} />
        </>
      )}
    </div>
  );
}
