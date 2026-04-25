export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

type Event = { date: number; kind: string; title: string; meta?: string };

async function buildTimeline(): Promise<Event[]> {
  ensureSchema();
  const d = db();
  const docs = d.$client.prepare(`SELECT date, category, title FROM document WHERE date IS NOT NULL ORDER BY date DESC`).all() as Array<{ date: number; category: string; title: string | null }>;
  const reports = d.$client.prepare(`SELECT created_at as date, kind, title FROM report ORDER BY created_at DESC`).all() as Array<{ date: number; kind: string; title: string }>;
  const out: Event[] = [];
  for (const x of docs) out.push({ date: x.date, kind: x.category, title: x.title ?? "(sans titre)" });
  for (const x of reports) out.push({ date: x.date, kind: "report", title: x.title });
  out.sort((a, b) => b.date - a.date);
  return out;
}

export default async function TimelinePage() {
  const events = await buildTimeline();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tous les événements santé classés du plus récent au plus ancien.</p>
      </div>
      <div className="relative pl-6">
        <div className="absolute left-[10px] top-2 bottom-0 w-px bg-border" />
        {events.length === 0 && <div className="text-muted-foreground text-sm">Aucun événement encore. Lance l'ingestion.</div>}
        {events.map((e, i) => (
          <div key={i} className="relative mb-5">
            <div className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald ring-4 ring-background" />
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{new Date(e.date).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</div>
            <div className="mt-0.5 font-medium">{e.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{e.kind}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
