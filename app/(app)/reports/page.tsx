import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getAll() {
  ensureSchema();
  const d = db();
  return d.$client.prepare(`SELECT id, kind, title, created_at FROM report ORDER BY created_at DESC`).all() as Array<{ id: number; kind: string; title: string; created_at: number }>;
}

export default async function ReportsPage() {
  const rows = await getAll();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">Synthèses générées : santé globale, biomarqueurs, ADN, longevity score.</p>
        </div>
        <a href="/api/reports/generate?kind=overview" className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition">+ Générer un rapport</a>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucun rapport encore. Clique sur "Générer un rapport" après avoir rempli ton profile et ingéré tes données.</div>}
        {rows.map((r) => (
          <Link key={r.id} href={`/reports/${r.id}`} className="block px-5 py-3 border-t border-border first:border-0 hover:bg-secondary/30 transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.kind} · {new Date(r.created_at).toLocaleString("fr-FR")}</div>
              </div>
              <span className="text-muted-foreground text-sm">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
