// Security audit trail (login attempts, signups, rate limits, password resets).
//
// Writes are best-effort by design and the caller must never fail a request
// because an audit write failed — but they now land in Convex rather than a
// local file, so the trail survives loss of the VPS.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

export const log = mutation({
  args: {
    secret: v.string(),
    action: v.string(),
    target: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.optional(v.number()),
  },
  handler: async (ctx, { secret, action, target, ip, userAgent, userId }) => {
    requireServer(secret);
    await ctx.db.insert("audit", {
      action,
      target,
      ip,
      userAgent,
      userId,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Powers the security page. Shape matches the old SQLite columns so the UI and
// the /api/security/audit payload stay unchanged.
export const list = query({
  args: { secret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { secret, limit }) => {
    requireServer(secret);
    const rows = await ctx.db.query("audit").order("desc").take(limit ?? 50);
    return {
      rows: rows.map((r) => ({
        id: r.legacyId ?? 0,
        action: r.action,
        target: r.target ?? null,
        ip: r.ip ?? null,
        user_agent: r.userAgent ?? null,
        created_at: r.createdAt,
      })),
    };
  },
});
