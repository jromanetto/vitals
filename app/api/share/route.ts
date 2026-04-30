import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import crypto from "node:crypto";

export const runtime = "nodejs";

type ShareRow = {
  id: number;
  token: string;
  scope: string;
  createdAt: number;
  expiresAt: number;
  views: number;
  lastViewedAt: number | null;
  revoked: number;
};

function publicBase(req: Request): string {
  const envBase = process.env.VITALS_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const url = new URL(req.url);
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || (url.protocol.replace(":", "")) || "https";
  return `${fwdProto}://${fwdHost}`;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const now = Date.now();
  const rows = sqlite
    .prepare(
      `SELECT id, token, scope, created_at AS createdAt, expires_at AS expiresAt, views, last_viewed_at AS lastViewedAt, revoked
       FROM share_link
       WHERE user_id = ? AND revoked = 0 AND expires_at > ?
       ORDER BY created_at DESC`
    )
    .all(userId, now) as ShareRow[];
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) {
    return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  }
  ensureSchema();
  let body: { scope?: string; durationHours?: number } = {};
  try { body = await req.json(); } catch {}
  const scope = body.scope === "full" ? "full" : "praticien";
  const durationHours = body.durationHours === 168 ? 168 : 24;
  const expiresAt = Date.now() + durationHours * 60 * 60 * 1000;
  const token = crypto.randomBytes(24).toString("base64url");
  const sqlite = db().$client;
  const info = sqlite
    .prepare(`INSERT INTO share_link (user_id, token, scope, expires_at) VALUES (?, ?, ?, ?)`)
    .run(userId, token, scope, expiresAt);
  const base = publicBase(req);
  const url = `${base}/share/${token}`;
  return NextResponse.json({ id: info.lastInsertRowid, url, token, expiresAt, scope });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) {
    return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  }
  ensureSchema();
  const url = new URL(req.url);
  const idStr = url.searchParams.get("id");
  const id = idStr ? Number(idStr) : NaN;
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }
  const sqlite = db().$client;
  const info = sqlite
    .prepare(`UPDATE share_link SET revoked = 1 WHERE id = ? AND user_id = ?`)
    .run(id, userId);
  if (info.changes === 0) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
