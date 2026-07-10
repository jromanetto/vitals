// Symptoms domain — migrated to Convex.
// Response shapes match the legacy /api/symptoms + /app/(app)/symptoms/[key]
// contracts (client keeps using the integer `legacyId` as `id`).
//   GET    /api/symptoms?days=  -> { rows: { id, date, key, value, notes, createdAt }[] }
//                                   (date DESC, then key ASC; filtered by `days` window)
//   POST   /api/symptoms         -> { ok: true }  (upsert keyed on (userId, date, key),
//                                   like the legacy INSERT OR REPLACE)
//   DELETE /api/symptoms?id=     -> { ok: true }  (by legacyId)
// The [key] detail page reads the full per-key history via `byKey`.
//
// `notes` is stored VERBATIM: the legacy route never ran crypto-fields on it, so
// Convex only does storage + tenant/Foyer isolation. (The schema tags the column
// ENCRYPTED for future use, but nothing in the current path encrypts it.)
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClient(doc: any) {
  return {
    id: doc.legacyId,
    date: doc.date,
    key: doc.key,
    value: doc.value,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt,
  };
}

// GET /api/symptoms?days=  -> { rows }
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
    const since = new Date(Date.now() - Math.min(365, days ?? 90) * 86400000)
      .toISOString()
      .slice(0, 10);
    const logs = await ctx.db
      .query("symptom_log")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const rows = logs
      .filter((l) => l.date >= since)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1; // date DESC
        return (a.key || "").localeCompare(b.key || ""); // then key ASC
      })
      .map(toClient);
    return { rows };
  },
});

// Full per-key history (date ASC) for the symptom detail page.
export const byKey = query({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    viewUserId: v.optional(v.number()),
    key: v.string(),
  },
  handler: async (ctx, { secret, authUserId, viewUserId, key }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const logs = await ctx.db
      .query("symptom_log")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
      .collect();
    const rows = logs
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) // date ASC
      .map((l) => ({ date: l.date, value: l.value, notes: l.notes ?? null }));
    return { rows };
  },
});

// POST /api/symptoms — upsert keyed on (userId, date, key). Writes scope to authUserId.
export const set = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    date: v.string(),
    key: v.string(),
    value: v.number(),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { secret, authUserId, date, key, value, notes }) => {
    requireServer(secret);
    const existing = await ctx.db
      .query("symptom_log")
      .withIndex("by_user_key", (q) => q.eq("userId", authUserId).eq("key", key))
      .filter((q) => q.eq(q.field("date"), date))
      .first();
    if (existing) {
      // Mirror INSERT OR REPLACE: overwrite value + notes (undefined clears notes).
      await ctx.db.patch(existing._id, { value, notes: notes ?? undefined });
      return { ok: true };
    }
    await ctx.db.insert("symptom_log", {
      legacyId: Date.now(),
      userId: authUserId,
      date,
      key,
      value,
      notes: notes ?? undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// DELETE /api/symptoms?id= — by legacyId, scoped to authUserId.
export const remove = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number() },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("symptom_log")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) => q.eq(q.field("legacyId"), id))
      .first();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});
