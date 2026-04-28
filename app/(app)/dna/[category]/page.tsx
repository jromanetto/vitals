import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import Link from "next/link";
import { NotesWidget } from "@/components/notes-widget";
import { HelpPill } from "@/components/help-pill";

export const dynamic = "force-dynamic";

async function load(category: string) {
  ensureSchema();
  const d = db();
  return d.$client.prepare(`
    SELECT rsid, trait, effect, magnitude, risk_allele as riskAllele, user_genotype as userGenotype, has_risk as hasRisk, is_protective as isProtective, summary, source
    FROM dna_insight WHERE category = ? ORDER BY (has_risk * COALESCE(magnitude,0)) DESC, magnitude DESC NULLS LAST
  `).all(category) as Array<{ rsid: string; trait: string; effect: string | null; magnitude: number | null; riskAllele: string | null; userGenotype: string | null; hasRisk: number | null; isProtective: number | null; summary: string | null; source: string | null }>;
}

export default async function DnaCat({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const rows = await load(category);
  return (
    <div className="space-y-6">
      <Link href="/dna" className="text-sm text-muted-foreground hover:text-foreground">← Toutes les catégories</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight capitalize">{category}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{rows.length} traits analysés</p>
      </div>
      <div className="grid gap-3">
        {rows.length === 0 && <div className="rounded-xl border border-border p-8 bg-card text-muted-foreground">Aucun insight encore généré pour cette catégorie.</div>}
        {rows.map((r) => (
          <article key={r.rsid + r.trait} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium tracking-tight">{r.trait}</h3>
                  <HelpPill
                    title={r.trait}
                    explanation={r.summary ?? r.effect ?? `Variant génétique ${r.rsid}. Clique pour demander à ton panel médical une explication détaillée et adaptée à ton génotype.`}
                    question={`J'ai le variant ${r.rsid} (${r.trait}) avec le génotype ${r.userGenotype ?? "inconnu"}. Explique-moi en termes simples ce que ça veut dire pour ma santé, et quelles actions concrètes je peux prendre (nutrition, supplémentation, sport, sommeil, monitoring biomarqueurs).`}
                    label={`Demander au panel médical à propos de ${r.trait}`}
                  />
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{r.rsid} · génotype {r.userGenotype ?? "?"}</div>
              </div>
              {r.isProtective === 1 ? (
                <span className="px-2 py-0.5 rounded-full text-xs border bg-emerald/15 text-emerald border-emerald/30 shrink-0">Protecteur</span>
              ) : r.hasRisk === 1 ? (
                <span className="px-2 py-0.5 rounded-full text-xs border bg-amber-500/15 text-amber-400 border-amber-500/30 shrink-0">À surveiller</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs border bg-secondary text-muted-foreground border-border shrink-0">Standard</span>
              )}
            </div>
            {r.effect && <p className="text-sm">{r.effect}</p>}
            {r.summary && <p className="text-sm text-muted-foreground leading-relaxed">{r.summary}</p>}
            {r.source && <a href={r.source} target="_blank" rel="noopener" className="inline-block text-xs text-muted-foreground hover:text-emerald">Source ↗</a>}
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground inline-flex items-center gap-1">
                <span className="group-open:hidden">+ Notes personnelles</span>
                <span className="hidden group-open:inline">− Masquer notes</span>
              </summary>
              <div className="mt-3">
                <NotesWidget targetType="dna" targetId={r.rsid} label="Notes" />
              </div>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
