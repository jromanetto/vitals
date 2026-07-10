// Reminders domain. Owner-scoped (NOT part of Foyer view-as — matches legacy,
// which read by currentUserId). The hourly cron uses `due` + `markNotified`.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClient(d: any) {
  return {
    id: d.legacyId,
    title: d.title,
    description: d.description ?? null,
    dueAt: d.dueAt,
    category: d.category ?? null,
    done: d.done ?? 0,
    createdAt: d.createdAt,
  };
}

export const list = query({
  args: { secret: v.string(), authUserId: v.number() },
  handler: async (ctx, { secret, authUserId }) => {
    requireServer(secret);
    const rows = await ctx.db
      .query("reminder")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .collect();
    rows.sort((a, b) => a.dueAt - b.dueAt);
    return { rows: rows.map(toClient) };
  },
});

export const create = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    title: v.string(),
    description: v.union(v.string(), v.null()),
    dueAt: v.number(),
    category: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { secret, authUserId, title, description, dueAt, category }) => {
    requireServer(secret);
    const legacyId = Date.now();
    const doc = {
      legacyId,
      userId: authUserId,
      title,
      description: description ?? undefined,
      dueAt,
      category: category ?? undefined,
      done: 0,
      createdAt: legacyId,
    };
    await ctx.db.insert("reminder", doc);
    return { row: toClient(doc) };
  },
});

export const setDone = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number(), done: v.boolean() },
  handler: async (ctx, { secret, authUserId, id, done }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("reminder")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) => q.eq(q.field("legacyId"), id))
      .first();
    if (!doc) return { ok: false, notFound: true };
    await ctx.db.patch(doc._id, { done: done ? 1 : 0 });
    return { row: toClient({ ...doc, done: done ? 1 : 0 }) };
  },
});

export const remove = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number() },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("reminder")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) => q.eq(q.field("legacyId"), id))
      .first();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});

// --- cron helpers (secret-only; operate across all users) ---
export const due = query({
  args: { secret: v.string(), horizon: v.number() },
  handler: async (ctx, { secret, horizon }) => {
    requireServer(secret);
    const all = await ctx.db.query("reminder").collect();
    const rows = all
      .filter((r) => (r.done ?? 0) === 0 && r.notifiedAt == null && r.dueAt <= horizon)
      .sort((a, b) => a.dueAt - b.dueAt)
      .map((r) => ({ id: r.legacyId, userId: r.userId, title: r.title, description: r.description ?? null, dueAt: r.dueAt }));
    return { rows };
  },
});

export const markNotified = mutation({
  args: { secret: v.string(), id: v.number(), at: v.number() },
  handler: async (ctx, { secret, id, at }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("reminder")
      .filter((q) => q.eq(q.field("legacyId"), id))
      .first();
    if (doc) await ctx.db.patch(doc._id, { notifiedAt: at });
    return { ok: true };
  },
});
