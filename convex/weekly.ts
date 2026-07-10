// Weekly check-in (bilan semaine) domain — migrated to Convex.
// Response shapes match the legacy /api/weekly contract (client keeps using the
// integer `legacyId` as the checkin `id`). Convex only does storage + tenant /
// Foyer isolation; the Next route owns ISO-week math, profile decryption and
// routine derivation (it holds the field key).
//
// FK note: weekly_habit / weekly_symptom reference their parent check-in via
// `checkinLegacyId` (== weekly_checkin.legacyId), read through the by_checkin
// index. `weekly_checkin.notes` is stored VERBATIM (the legacy route neither
// encrypts nor decrypts it).
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkinToClient(doc: any) {
  return {
    id: doc.legacyId,
    weekIso: doc.weekIso,
    weekStart: doc.weekStart,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// GET /api/weekly?week=  -> { checkin, symptoms, habits, trend, profileData }
// The route wraps this with weekIso + derived routines.
export const get = query({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    viewUserId: v.optional(v.number()),
    weekIso: v.string(),
  },
  handler: async (ctx, { secret, authUserId, viewUserId, weekIso }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);

    // Selected week's check-in + its habit/symptom children.
    const checkin = await ctx.db
      .query("weekly_checkin")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekIso", weekIso))
      .first();

    const symptoms: Record<string, number> = {};
    const habits: Record<string, number> = {};
    if (checkin) {
      const symRows = await ctx.db
        .query("weekly_symptom")
        .withIndex("by_checkin", (q) => q.eq("checkinLegacyId", checkin.legacyId))
        .collect();
      for (const r of symRows) symptoms[r.key] = r.avgValue;
      const habRows = await ctx.db
        .query("weekly_habit")
        .withIndex("by_checkin", (q) => q.eq("checkinLegacyId", checkin.legacyId))
        .collect();
      for (const r of habRows) habits[r.key] = r.countOutOf7;
    }

    // Last 12 weeks for the trend chart (by week_start DESC).
    const allCheckins = await ctx.db
      .query("weekly_checkin")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    allCheckins.sort((a, b) => b.weekStart - a.weekStart);
    const trend = [];
    for (const wc of allCheckins.slice(0, 12)) {
      const syms = await ctx.db
        .query("weekly_symptom")
        .withIndex("by_checkin", (q) => q.eq("checkinLegacyId", wc.legacyId))
        .collect();
      const habs = await ctx.db
        .query("weekly_habit")
        .withIndex("by_checkin", (q) => q.eq("checkinLegacyId", wc.legacyId))
        .collect();
      trend.push({
        id: wc.legacyId,
        weekIso: wc.weekIso,
        weekStart: wc.weekStart,
        avgSymptom: avg(syms.map((s) => s.avgValue)),
        avgHabit: avg(habs.map((h) => h.countOutOf7)),
      });
    }

    // Raw (still field-encrypted) profile blob — the route decrypts it and
    // derives the personalised routines. Latest by updatedAt.
    const profiles = await ctx.db
      .query("profile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    profiles.sort((a, b) => b.updatedAt - a.updatedAt);
    const profileData = profiles.length ? profiles[0].data : null;

    return {
      checkin: checkin ? checkinToClient(checkin) : null,
      symptoms,
      habits,
      trend,
      profileData,
    };
  },
});

// POST /api/weekly — upsert one weekly_checkin (keyed on user_id + week_iso)
// plus its habit/symptom children. Writes ALWAYS scope to authUserId (Foyer:
// read-only view-as). Replicates the legacy single transaction faithfully:
// upsert checkin (on conflict update notes + updatedAt only), then replace all
// child rows.
export const upsert = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    weekIso: v.string(),
    weekStart: v.number(),
    notes: v.optional(v.union(v.string(), v.null())),
    symptoms: v.record(v.string(), v.number()),
    habits: v.record(v.string(), v.number()),
  },
  handler: async (ctx, { secret, authUserId, weekIso, weekStart, notes, symptoms, habits }) => {
    requireServer(secret);
    const userId = authUserId;
    const now = Date.now();

    // Upsert the checkin. On conflict (existing week) only notes + updatedAt
    // change — week_start is preserved, matching the legacy ON CONFLICT clause.
    const existing = await ctx.db
      .query("weekly_checkin")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekIso", weekIso))
      .first();
    let checkinLegacyId: number;
    if (existing) {
      await ctx.db.patch(existing._id, { notes: notes ?? undefined, updatedAt: now });
      checkinLegacyId = existing.legacyId;
    } else {
      checkinLegacyId = now;
      await ctx.db.insert("weekly_checkin", {
        legacyId: checkinLegacyId,
        userId,
        weekIso,
        weekStart,
        notes: notes ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Replace symptom rows (clamp 0-10, skip non-finite, key <= 60 chars).
    const oldSyms = await ctx.db
      .query("weekly_symptom")
      .withIndex("by_checkin", (q) => q.eq("checkinLegacyId", checkinLegacyId))
      .collect();
    for (const s of oldSyms) await ctx.db.delete(s._id);
    for (const [k, val] of Object.entries(symptoms)) {
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      const clamped = Math.max(0, Math.min(10, val));
      await ctx.db.insert("weekly_symptom", {
        checkinLegacyId,
        key: String(k).slice(0, 60),
        avgValue: clamped,
      });
    }

    // Replace habit rows (clamp 0-7, round, key <= 60 chars).
    const oldHabs = await ctx.db
      .query("weekly_habit")
      .withIndex("by_checkin", (q) => q.eq("checkinLegacyId", checkinLegacyId))
      .collect();
    for (const h of oldHabs) await ctx.db.delete(h._id);
    for (const [k, val] of Object.entries(habits)) {
      const c = Math.max(0, Math.min(7, Math.round(Number(val) || 0)));
      await ctx.db.insert("weekly_habit", {
        checkinLegacyId,
        key: String(k).slice(0, 60),
        countOutOf7: c,
      });
    }

    return { ok: true, weekIso };
  },
});
