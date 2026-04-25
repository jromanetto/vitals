import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function load(id: number) {
  ensureSchema();
  return db().$client.prepare(`SELECT id, kind, title, body, created_at FROM report WHERE id = ?`).get(id) as { id: number; kind: string; title: string; body: string; created_at: number } | undefined;
}

function renderMarkdown(md: string): string {
  // Tiny markdown → safe-ish HTML for trusted local LLM output.
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-medium mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-semibold mt-2 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\s*)+/g, '<ul class="space-y-1 my-3">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>');
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(+id);
  if (!r) return <div className="text-muted-foreground">Rapport introuvable.</div>;
  return (
    <article className="max-w-3xl">
      <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">← Tous les rapports</Link>
      <header className="mt-3 mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{r.kind}</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{r.title}</h1>
        <div className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("fr-FR")}</div>
      </header>
      <div className="prose prose-invert prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.body) }} />
    </article>
  );
}
