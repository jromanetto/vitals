import { NextResponse } from "next/server";
import { currentUserId , effectiveUserId} from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { decryptProfile } from "@/lib/crypto-fields";
import { getRoutinesOrDefault } from "@/lib/weekly/routines";

export const runtime = "nodejs";

/**
 * Weekly check-in API.
 *
 * GET  /api/weekly?week=YYYY-Www  → returns the saved bilan for that ISO week
 *                                    (defaults to the current week), plus the
 *                                    last 12 weeks of summary data for the
 *                                    trend chart.
 *
 * POST /api/weekly                → upsert one row in weekly_checkin keyed by
 *                                    (user_id, week_iso). Body:
 *                                    { weekIso, symptoms:{key:1-10},
 *                                      habits:{key:0-7}, notes }
 *                                    Wraps the writes in a single transaction.
 */

function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function isoWeekMonday(weekIso: string): Date {
  const m = weekIso.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return new Date();
  const y = Number(m[1]);
  const w = Number(m[2]);
  // ISO 8601: week containing Jan 4 is W01. Find Monday of that week, then
  // add (w-1) weeks.
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow + 1);
  const result = new Date(week1Monday);
  result.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  return result;
}

type CheckinRow = {
  id: number;
  weekIso: string;
  weekStart: number;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};

export async function GET(req: Request) {
  const userId = await effectiveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const url = new URL(req.url);
  const weekIso = url.searchParams.get("week") || isoWeekString(new Date());

  const checkin = sqlite
    .prepare(
      `SELECT id, week_iso AS weekIso, week_start AS weekStart, notes,
              created_at AS createdAt, updated_at AS updatedAt
       FROM weekly_checkin
       WHERE user_id = ? AND week_iso = ?`,
    )
    .get(userId, weekIso) as CheckinRow | undefined;

  const symptoms: Record<string, number> = {};
  const habits: Record<string, number> = {};
  if (checkin) {
    const symRows = sqlite
      .prepare(`SELECT key, avg_value AS value FROM weekly_symptom WHERE checkin_id = ?`)
      .all(checkin.id) as { key: string; value: number }[];
    for (const r of symRows) symptoms[r.key] = r.value;
    const habRows = sqlite
      .prepare(`SELECT key, count_out_of_7 AS count FROM weekly_habit WHERE checkin_id = ?`)
      .all(checkin.id) as { key: string; count: number }[];
    for (const r of habRows) habits[r.key] = r.count;
  }

  // Last 12 weeks for the trend chart
  const trend = sqlite
    .prepare(
      `SELECT wc.id, wc.week_iso AS weekIso, wc.week_start AS weekStart,
              (SELECT AVG(avg_value) FROM weekly_symptom WHERE checkin_id = wc.id) AS avgSymptom,
              (SELECT AVG(count_out_of_7) FROM weekly_habit WHERE checkin_id = wc.id) AS avgHabit
       FROM weekly_checkin wc
       WHERE wc.user_id = ?
       ORDER BY wc.week_start DESC LIMIT 12`,
    )
    .all(userId) as Array<{ id: number; weekIso: string; weekStart: number; avgSymptom: number | null; avgHabit: number | null }>;

  // Personalise routines from the user's declared profile (activityLevel,
  // meditation, intermittentFasting, sleep target, water target, sauna /
  // cold / stretching / breathwork / morning light frequencies). Fallback
  // to a sensible default list if the profile is empty.
  const profileRow = sqlite
    .prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(userId) as { data: string | object } | undefined;
  let profile: Record<string, unknown> = {};
  if (profileRow) {
    try {
      const raw = typeof profileRow.data === "string" ? JSON.parse(profileRow.data) : profileRow.data;
      profile = decryptProfile(raw) ?? {};
    } catch { profile = {}; }
  }
  const { routines, fromProfile } = getRoutinesOrDefault(profile);

  return NextResponse.json({ weekIso, checkin: checkin ?? null, symptoms, habits, trend, routines, routinesFromProfile: fromProfile });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const body = (await req.json().catch(() => ({}))) as {
    weekIso?: string;
    symptoms?: Record<string, number>;
    habits?: Record<string, number>;
    notes?: string | null;
  };
  const weekIso = body.weekIso || isoWeekString(new Date());
  if (!/^\d{4}-W\d{1,2}$/.test(weekIso)) {
    return NextResponse.json({ error: "weekIso invalide" }, { status: 400 });
  }
  const monday = isoWeekMonday(weekIso);
  const weekStart = monday.getTime();
  const symptoms = body.symptoms ?? {};
  const habits = body.habits ?? {};
  const notes = body.notes ? String(body.notes).slice(0, 4000) : null;
  const now = Date.now();

  const tx = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO weekly_checkin (user_id, week_iso, week_start, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, week_iso) DO UPDATE SET
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
      )
      .run(userId, weekIso, weekStart, notes, now, now);
    const row = sqlite
      .prepare(`SELECT id FROM weekly_checkin WHERE user_id = ? AND week_iso = ?`)
      .get(userId, weekIso) as { id: number };
    const checkinId = row.id;

    sqlite.prepare(`DELETE FROM weekly_symptom WHERE checkin_id = ?`).run(checkinId);
    const symStmt = sqlite.prepare(
      `INSERT INTO weekly_symptom (checkin_id, key, avg_value) VALUES (?, ?, ?)`,
    );
    for (const [k, v] of Object.entries(symptoms)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const clamped = Math.max(0, Math.min(10, v));
      symStmt.run(checkinId, String(k).slice(0, 60), clamped);
    }

    sqlite.prepare(`DELETE FROM weekly_habit WHERE checkin_id = ?`).run(checkinId);
    const habStmt = sqlite.prepare(
      `INSERT INTO weekly_habit (checkin_id, key, count_out_of_7) VALUES (?, ?, ?)`,
    );
    for (const [k, v] of Object.entries(habits)) {
      const c = Math.max(0, Math.min(7, Math.round(Number(v) || 0)));
      habStmt.run(checkinId, String(k).slice(0, 60), c);
    }
  });
  tx();

  return NextResponse.json({ ok: true, weekIso });
}
