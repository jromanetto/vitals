// Personal access tokens for the read-only MCP server. Only the SHA-256 of the
// token is stored; the plaintext is shown once at creation. Scoped to one user
// (the legacyId), revocable. All functions are secret-gated — the Next.js layer
// is the only trusted caller.
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

export const issue = mutation({
  args: { secret: v.string(), authUserId: v.number(), tokenHash: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, { secret, authUserId, tokenHash, name }) => {
    requireServer(secret);
    const id = await ctx.db.insert("mcp_token", {
      userId: authUserId,
      tokenHash,
      name: name || undefined,
      revoked: 0,
      createdAt: Date.now(),
    });
    return { ok: true, id };
  },
});

// Active (non-revoked) tokens for a user. Never returns the hash.
export const list = query({
  args: { secret: v.string(), authUserId: v.number() },
  handler: async (ctx, { secret, authUserId }) => {
    requireServer(secret);
    const rows = await ctx.db
      .query("mcp_token")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .collect();
    return {
      rows: rows
        .filter((r) => r.revoked === 0)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({ id: r._id, name: r.name ?? null, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt ?? null })),
    };
  },
});

export const revoke = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.id("mcp_token") },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const row = await ctx.db.get(id);
    // Ownership check: a token can only be revoked by its own user.
    if (!row || row.userId !== authUserId) return { ok: false };
    await ctx.db.patch(id, { revoked: 1 });
    return { ok: true };
  },
});

// Hot path for every MCP request: resolve a token hash to its user id, bumping
// lastUsedAt for the audit trail. Returns { userId: null } for unknown/revoked
// tokens — the caller maps that to 401.
export const resolve = mutation({
  args: { secret: v.string(), tokenHash: v.string() },
  handler: async (ctx, { secret, tokenHash }) => {
    requireServer(secret);
    const row = await ctx.db
      .query("mcp_token")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!row || row.revoked === 1) return { userId: null };
    await ctx.db.patch(row._id, { lastUsedAt: Date.now() });
    return { userId: row.userId };
  },
});
