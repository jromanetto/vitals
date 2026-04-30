import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const body = await req.json().catch(() => null) as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    | null;

  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const auth = body?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent") ?? null;
  const sqlite = db().$client;
  // Upsert by endpoint (unique). On conflict, refresh keys + user.
  sqlite
    .prepare(
      `INSERT INTO push_subscription (user_id, endpoint, p256dh, auth, user_agent, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         last_used_at = excluded.last_used_at`
    )
    .run(userId, endpoint, p256dh, auth, ua, Date.now());

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const rows = sqlite
    .prepare(
      `SELECT id, endpoint, user_agent, created_at, last_used_at
       FROM push_subscription WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(userId);
  return NextResponse.json({ rows });
}
