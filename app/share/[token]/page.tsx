import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { loadPraticienData } from "@/lib/praticien-data";
import { PraticienReport } from "@/components/praticien-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function SharePage({ params }: Ctx) {
  const { token } = await params;
  ensureSchema();
  const sqlite = db().$client;
  const now = Date.now();
  const row = sqlite
    .prepare(
      `SELECT id, user_id AS userId, scope, expires_at AS expiresAt, revoked, views
       FROM share_link WHERE token = ?`
    )
    .get(token) as { id: number; userId: number; scope: string; expiresAt: number; revoked: number; views: number } | undefined;

  if (!row || row.revoked === 1 || row.expiresAt <= now) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Lien expiré</h1>
          <p className="text-sm text-gray-600 mt-3">
            Ce lien partagé n’est plus valide. Demande au patient de générer un nouveau lien.
          </p>
          <p className="text-xs text-gray-400 mt-6">vitals.blueproject.org</p>
        </div>
      </div>
    );
  }

  // increment view counter (best-effort)
  try {
    sqlite.prepare(`UPDATE share_link SET views = views + 1, last_viewed_at = ? WHERE id = ?`).run(now, row.id);
  } catch {}

  const data = await loadPraticienData(row.userId);
  const views = row.views + 1;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-[800px] mx-auto px-4 md:px-0 py-6 print:max-w-none print:mx-0 print:py-0">
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 no-print">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 justify-between">
            <div className="font-medium">
              Lien partagé · Lecture seule
            </div>
            <div className="text-xs text-amber-800">
              Expire le {fmtDateTime(row.expiresAt)} · Vu {views} fois
            </div>
          </div>
        </div>

        <div className="praticien-doc bg-white text-black">
          <PraticienReport data={data} anonymized />
          <footer className="mt-10 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
            Document généré par Vitals · vitals.blueproject.org
          </footer>
        </div>
      </div>
    </div>
  );
}
