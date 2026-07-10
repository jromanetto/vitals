import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
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

export async function GET(req: Request) {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const weekIso = url.searchParams.get("week") || isoWeekString(new Date());

  const res = await convexServer().query(api.weekly.get, {
    secret: bridgeSecret(),
    authUserId,
    viewUserId: viewUserId ?? authUserId,
    weekIso,
  });

  // Personalise routines from the user's declared profile (activityLevel,
  // meditation, intermittentFasting, sleep target, water target, sauna /
  // cold / stretching / breathwork / morning light frequencies). Fallback
  // to a sensible default list if the profile is empty. The profile blob is
  // stored field-encrypted; decrypt it here (the route holds the field key).
  let profile: Record<string, unknown> = {};
  if (res.profileData) {
    try {
      const raw = JSON.parse(res.profileData);
      profile = decryptProfile(raw) ?? {};
    } catch { profile = {}; }
  }
  const { routines, fromProfile } = getRoutinesOrDefault(profile);

  return NextResponse.json({
    weekIso,
    checkin: res.checkin,
    symptoms: res.symptoms,
    habits: res.habits,
    trend: res.trend,
    routines,
    routinesFromProfile: fromProfile,
  });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  // notes stored VERBATIM (never encrypted/decrypted by this route); the 4000
  // char cap is the same input guard the legacy route applied.
  const notes = body.notes ? String(body.notes).slice(0, 4000) : null;

  const res = await convexServer().mutation(api.weekly.upsert, {
    secret: bridgeSecret(),
    authUserId: userId,
    weekIso,
    weekStart,
    notes,
    symptoms,
    habits,
  });

  return NextResponse.json(res);
}
