// Push subscriptions. Owner-scoped writes; the cron + lib/push read subs for
// sending and prune expired endpoints. Server-bridge secret-gated.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

export const subscribe = mutation({
  args: {
    secret: v.string(),
    userId: v.number(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { secret, userId, endpoint, p256dh, auth, userAgent }) => {
    requireServer(secret);
    const now = Date.now();
    const existing = await ctx.db
      .query("push_subscription")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { userId, p256dh, auth, userAgent: userAgent ?? undefined, lastUsedAt: now });
    } else {
      await ctx.db.insert("push_subscription", {
        legacyId: now, userId, endpoint, p256dh, auth, userAgent: userAgent ?? undefined, createdAt: now, lastUsedAt: now,
      });
    }
    return { ok: true };
  },
});

export const unsubscribe = mutation({
  args: { secret: v.string(), userId: v.number(), id: v.optional(v.number()), endpoint: v.optional(v.string()) },
  handler: async (ctx, { secret, userId, id, endpoint }) => {
    requireServer(secret);
    let doc = null;
    if (id != null) {
      doc = await ctx.db
        .query("push_subscription")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("legacyId"), id))
        .first();
    } else if (endpoint) {
      doc = await ctx.db
        .query("push_subscription")
        .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
        .first();
      if (doc && doc.userId !== userId) doc = null; // scope to owner
    }
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});

// Settings list (safe fields only).
export const listForUser = query({
  args: { secret: v.string(), userId: v.number() },
  handler: async (ctx, { secret, userId }) => {
    requireServer(secret);
    const rows = await ctx.db
      .query("push_subscription")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return { rows: rows.map((r) => ({ id: r.legacyId, endpoint: r.endpoint, user_agent: r.userAgent ?? null, created_at: r.createdAt, last_used_at: r.lastUsedAt ?? null })) };
  },
});

// Full subs for sending (endpoint + keys). Secret-only (used server-side/cron).
export const subsForSend = query({
  args: { secret: v.string(), userId: v.number() },
  handler: async (ctx, { secret, userId }) => {
    requireServer(secret);
    const rows = await ctx.db
      .query("push_subscription")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return { rows: rows.map((r) => ({ id: r.legacyId, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth })) };
  },
});

export const touchLastUsed = mutation({
  args: { secret: v.string(), id: v.number() },
  handler: async (ctx, { secret, id }) => {
    requireServer(secret);
    const doc = await ctx.db.query("push_subscription").filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (doc) await ctx.db.patch(doc._id, { lastUsedAt: Date.now() });
    return { ok: true };
  },
});

// Prune an expired endpoint (410/404).
export const deleteById = mutation({
  args: { secret: v.string(), id: v.number() },
  handler: async (ctx, { secret, id }) => {
    requireServer(secret);
    const doc = await ctx.db.query("push_subscription").filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});
