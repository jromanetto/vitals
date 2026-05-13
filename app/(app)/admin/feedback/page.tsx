import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: number;
  user_id: number;
  report_id: number;
  card_index: number;
  card_title: string;
  rating: "up" | "down";
  comment: string | null;
  created_at: number;
  email: string | null;
};

const FOUNDER_ROLES = new Set(["owner", "founder"]);

function getUserRole(userId: number): string | null {
  try {
    const sqlite = db().$client;
    const row = sqlite
      .prepare(`SELECT role FROM user WHERE id = ?`)
      .get(userId) as { role: string | null } | undefined;
    return row?.role ?? null;
  } catch {
    return null;
  }
}

function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

function truncate(s: string | null, max = 120): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default async function AdminFeedbackPage() {
  const userId = await currentUserId();
  if (!userId) notFound();
  const role = getUserRole(userId);
  if (!role || !FOUNDER_ROLES.has(role)) notFound();

  ensureSchema();
  const sqlite = db().$client;
  const rows = sqlite
    .prepare(
      `SELECT cf.id, cf.user_id, cf.report_id, cf.card_index, cf.card_title, cf.rating, cf.comment, cf.created_at, u.email
       FROM card_feedback cf
       LEFT JOIN user u ON u.id = cf.user_id
       ORDER BY cf.created_at DESC
       LIMIT 100`,
    )
    .all() as Row[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retours sur le rapport d'accueil"
        description="Les 100 derniers retours laissés par les utilisateurs."
      />

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground rounded-lg border border-border bg-secondary/30 p-6 text-center">
          Aucun retour pour le moment.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Utilisateur</th>
                <th className="text-left px-3 py-2 font-medium">Carte</th>
                <th className="text-left px-3 py-2 font-medium">Avis</th>
                <th className="text-left px-3 py-2 font-medium">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.email ?? `#${r.user_id}`}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">{r.card_title}</span>
                    <span className="text-muted-foreground text-xs ml-1">
                      (rapport #{r.report_id})
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.rating === "up" ? (
                      <span className="text-emerald-500" aria-label="Pouce en l'air">👍</span>
                    ) : (
                      <span className="text-rose-500" aria-label="Pouce en bas">👎</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-md">
                    {truncate(r.comment)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
