import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

type Rating = "up" | "down";

type FeedbackRow = {
  id: number;
  user_id: number;
  report_id: number;
  card_index: number;
  card_title: string;
  rating: Rating;
  comment: string | null;
  created_at: number;
  email: string | null;
};

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

const FOUNDER_ROLES = new Set(["owner", "founder"]);

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  ensureSchema();

  let body: {
    reportId?: number;
    cardIndex?: number;
    cardTitle?: string;
    rating?: string;
    comment?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const reportId = Number(body.reportId);
  const cardIndex = Number(body.cardIndex);
  const cardTitle = (body.cardTitle ?? "").toString().trim();
  const rating = body.rating;
  const comment = body.comment?.toString().trim() || null;

  if (!Number.isFinite(reportId) || reportId <= 0) {
    return NextResponse.json({ error: "reportId requis" }, { status: 400 });
  }
  if (!Number.isFinite(cardIndex) || cardIndex < 0) {
    return NextResponse.json({ error: "cardIndex requis" }, { status: 400 });
  }
  if (!cardTitle) {
    return NextResponse.json({ error: "cardTitle requis" }, { status: 400 });
  }
  if (rating !== "up" && rating !== "down") {
    return NextResponse.json({ error: "rating invalide" }, { status: 400 });
  }

  const sqlite = db().$client;
  const info = sqlite
    .prepare(
      `INSERT INTO card_feedback (user_id, report_id, card_index, card_title, rating, comment) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, reportId, cardIndex, cardTitle, rating, comment);

  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  ensureSchema();

  const role = getUserRole(userId);
  if (!role || !FOUNDER_ROLES.has(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sqlite = db().$client;
  const rows = sqlite
    .prepare(
      `SELECT cf.id, cf.user_id, cf.report_id, cf.card_index, cf.card_title, cf.rating, cf.comment, cf.created_at, u.email
       FROM card_feedback cf
       LEFT JOIN user u ON u.id = cf.user_id
       ORDER BY cf.created_at DESC
       LIMIT 100`,
    )
    .all() as FeedbackRow[];

  return NextResponse.json({ rows });
}
