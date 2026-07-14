// Habits domain — migrated to Convex.
// Response shapes match the legacy /api/habits contract:
//   GET    -> { rows: { date, key, value }[] }  (date DESC, filtered by `days` window)
//   POST   -> { ok: true }  (upsert keyed on (userId, date, key), like INSERT OR REPLACE)
//   DELETE -> { ok: true }
// habit_log has no encrypted fields; Convex only does storage + tenant/Foyer isolation.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

// GET /api/habits?days=  -> { rows }
export const list = query({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    viewUserId: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, { secret, authUserId, viewUserId, days }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const since = new Date(Date.now() - Math.min(3650, days ?? 60) * 86400000)
      .toISOString()
      .slice(0, 10);
    const logs = await ctx.db
      .query("habit_log")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const rows = logs
      .filter((l) => l.date >= since)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((l) => ({ date: l.date, key: l.key, value: l.value }));
    return { rows };
  },
});

// POST /api/habits — upsert keyed on (userId, date, key). Writes scope to authUserId.
export const set = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    date: v.string(),
    key: v.string(),
    value: v.number(),
  },
  handler: async (ctx, { secret, authUserId, date, key, value }) => {
    requireServer(secret);
    const existing = await ctx.db
      .query("habit_log")
      .withIndex("by_user_key", (q) => q.eq("userId", authUserId).eq("key", key))
      .filter((q) => q.eq(q.field("date"), date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
      return { ok: true };
    }
    await ctx.db.insert("habit_log", {
      legacyId: Date.now(),
      userId: authUserId,
      date,
      key,
      value,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// DELETE /api/habits?date=&key= — scope to authUserId.
export const remove = mutation({
  args: { secret: v.string(), authUserId: v.number(), date: v.string(), key: v.string() },
  handler: async (ctx, { secret, authUserId, date, key }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("habit_log")
      .withIndex("by_user_key", (q) => q.eq("userId", authUserId).eq("key", key))
      .filter((q) => q.eq(q.field("date"), date))
      .first();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});
