import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { NotesWidget } from "@/components/notes-widget";
import Link from "next/link";

export const dynamic = "force-dynamic";

// The document row stays on SQLite; the extracted biomarkers now come from
// Convex (self / effective user) and are filtered to this document's source.
async function load(id: number, authUserId: number, viewUserId: number) {
  ensureSchema();
  const sqlite = db().$client;
  const doc = sqlite.prepare(`SELECT id, path, title, category, date, pages FROM document WHERE id = ? AND user_id = ?`).get(id, viewUserId) as { id: number; path: string; title: string | null; category: string; date: number | null; pages: number | null } | undefined;
  if (!doc) return null;
  const { rows } = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId, viewUserId,
  });
  const bms = rows
    .filter((r) => r.source === doc.path)
    .map((r) => ({ name: r.name, value: r.value, unit: r.unit }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30);
  return { doc, bms };
}

export default async function FilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewUserId = await effectiveUserId();
  const authUserId = await currentUserId();
  if (!viewUserId || !authUserId) return <div className="text-muted-foreground">Document introuvable.</div>;
  const data = await load(+id, authUserId, viewUserId);
  if (!data) return <div className="text-muted-foreground">Document introuvable.</div>;
  const { doc, bms } = data;
  const fileName = doc.path.split("/").slice(-1)[0];

  return (
    <div className="space-y-8">
      <Link href="/knowledge" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">← Knowledge</Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">{doc.category}</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-2 break-all">{doc.title || fileName}</h1>
          <div className="text-xs text-muted-foreground mt-2">
            {doc.date && new Date(doc.date).toLocaleDateString("fr-FR")} {doc.pages && `· ${doc.pages} pages`}
          </div>
        </div>
        <a href={`/api/files/${doc.id}`} download className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-md bg-secondary border border-border hover:bg-secondary/70 transition shrink-0">⬇ Télécharger</a>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-xl border border-border bg-card overflow-hidden h-[78vh]">
          <iframe src={`/api/files/${doc.id}#view=FitH`} className="w-full h-full" title={fileName} />
        </div>
        <aside className="space-y-4">
          {bms.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Biomarqueurs extraits ({bms.length})</div>
              <div className="space-y-1.5">
                {bms.map((b) => (
                  <div key={b.name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">{b.name}</span>
                    <span className="font-mono text-xs">{b.value} <span className="text-muted-foreground">{b.unit}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <NotesWidget targetType="file" targetId={String(doc.id)} label="Notes sur ce document" />
        </aside>
      </div>
    </div>
  );
}
