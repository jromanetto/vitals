// Notes domain. Convex stores note bodies VERBATIM (private notes are already
// AES-encrypted in the value, non-private are plaintext) — decryption/masking
// and the `private` encrypt-on-write happen in the Next route (which holds the
// field key), exactly as before. Convex only does storage + tenant/Foyer
// isolation + tag aggregation.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClient(doc: any) {
  return {
    id: doc.legacyId,
    targetType: doc.targetType,
    targetId: doc.targetId,
    body: doc.body,
    tags: doc.tags ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const list = query({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    viewUserId: v.optional(v.number()),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, { secret, authUserId, viewUserId, targetType, targetId, tag }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const all = await ctx.db
      .query("note")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    all.sort((a, b) => b.createdAt - a.createdAt);
    let rows = all;
    if (targetType && targetId) {
      rows = all.filter((n) => n.targetType === targetType && n.targetId === targetId);
    } else if (tag) {
      rows = all.filter((n) => (n.tags ?? "").includes(tag));
    } else {
      rows = all.slice(0, 200);
    }
    const tagSet = new Set<string>();
    for (const n of all) {
      for (const t of (n.tags ?? "").split(",")) {
        const tt = t.trim();
        if (tt) tagSet.add(tt);
      }
    }
    return { rows: rows.map(toClient), tags: [...tagSet].sort() };
  },
});

// Writes always scope to authUserId. `body` arrives already encrypted-or-not
// (the route applies the `private` flag). `tags` arrives normalized.
export const upsert = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    id: v.optional(v.number()),
    targetType: v.string(),
    targetId: v.string(),
    body: v.string(),
    tags: v.string(),
  },
  handler: async (ctx, { secret, authUserId, id, targetType, targetId, body, tags }) => {
    requireServer(secret);
    const now = Date.now();
    if (id != null) {
      const existing = await ctx.db
        .query("note")
        .withIndex("by_user", (q) => q.eq("userId", authUserId))
        .filter((q) => q.eq(q.field("legacyId"), id))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { body, tags, updatedAt: now });
        return { ok: true, id };
      }
    }
    const legacyId = id ?? now;
    await ctx.db.insert("note", {
      legacyId,
      userId: authUserId,
      targetType,
      targetId,
      body,
      tags,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, id: legacyId };
  },
});

export const remove = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number() },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("note")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) => q.eq(q.field("legacyId"), id))
      .first();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});
