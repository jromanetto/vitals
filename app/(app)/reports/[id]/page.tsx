import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { ReportBodyPoller } from "@/components/report-body-poller";
import { PrintTrigger } from "@/components/print-trigger";

export const dynamic = "force-dynamic";

async function load(id: number) {
  ensureSchema();
  return db().$client.prepare(`SELECT id, kind, title, body, created_at FROM report WHERE id = ?`).get(id) as { id: number; kind: string; title: string; body: string; created_at: number } | undefined;
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  const r = await load(+id);
  if (!r) return <div className="text-muted-foreground">Rapport introuvable.</div>;

  const generating = !r.body || r.body.length < 30;
  const printMode = print === "1";
  const isDoctorPack = r.kind === "doctor-pack";

  return (
    <article className={printMode ? "praticien-doc max-w-3xl mx-auto" : "max-w-3xl"}>
      {printMode && !generating && <PrintTrigger />}
      {!printMode && (
        <div className="no-print flex items-center justify-between gap-3">
          <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">
            ← Tous les rapports
          </Link>
          {isDoctorPack && !generating && (
            <Link
              href={`/praticien/${r.id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-secondary/40 transition-colors"
            >
              Vue praticien (A4)
            </Link>
          )}
        </div>
      )}
      <header className={printMode ? "mb-8" : "mt-4 mb-8"}>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium capitalize">{r.kind.replace(/-/g, " ")}</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">{r.title}</h1>
        <div className="text-xs text-muted-foreground mt-2">{new Date(r.created_at).toLocaleString("fr-FR")}</div>
      </header>
      {generating ? (
        <ReportBodyPoller id={r.id} initialBody={r.body} />
      ) : (
        <div className="prose prose-invert prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.body) }} />
      )}
    </article>
  );
}
