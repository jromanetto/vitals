import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { loadPraticienData } from "@/lib/praticien-data";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "gone" }, { status: 410 });
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
    return NextResponse.json({ error: "gone" }, { status: 410 });
  }
  sqlite
    .prepare(`UPDATE share_link SET views = views + 1, last_viewed_at = ? WHERE id = ?`)
    .run(now, row.id);
  const data = await loadPraticienData(row.userId);
  return NextResponse.json({ scope: row.scope, expiresAt: row.expiresAt, views: row.views + 1, data });
}
