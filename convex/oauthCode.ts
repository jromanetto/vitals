// Authorization codes for the OAuth 2.0 + PKCE connector flow. Only the sha256
// of the code is stored; single-use; short TTL. Secret-gated — the Next.js
// layer is the only trusted caller.
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

export const issue = mutation({
  args: {
    secret: v.string(),
    codeHash: v.string(),
    userId: v.number(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, { secret, codeHash, userId, clientId, redirectUri, codeChallenge, scope, expiresAt }) => {
    requireServer(secret);
    await ctx.db.insert("oauth_code", {
      codeHash,
      userId,
      clientId,
      redirectUri,
      codeChallenge,
      scope,
      used: 0,
      expiresAt,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Validate AND burn the code in one transaction. Flat return shape (the `ok`
// narrowing does not survive Convex serialization); every field is null on a
// failure path.
export const consume = mutation({
  args: { secret: v.string(), codeHash: v.string() },
  handler: async (ctx, { secret, codeHash }) => {
    requireServer(secret);
    const row = await ctx.db
      .query("oauth_code")
      .withIndex("by_code", (q) => q.eq("codeHash", codeHash))
      .first();
    if (!row) return { ok: false, userId: null, clientId: null, redirectUri: null, codeChallenge: null };
    if (row.used === 1 || row.expiresAt <= Date.now()) {
      return { ok: false, userId: null, clientId: null, redirectUri: null, codeChallenge: null };
    }
    await ctx.db.patch(row._id, { used: 1 });
    return {
      ok: true,
      userId: row.userId,
      clientId: row.clientId,
      redirectUri: row.redirectUri,
      codeChallenge: row.codeChallenge,
    };
  },
});
