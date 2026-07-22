// Password-reset tokens. Only the SHA-256 of the token is stored, so a database
// read cannot be turned into an account takeover; the plaintext token exists
// only in the email link.
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

export const issue = mutation({
  args: { secret: v.string(), email: v.string(), tokenHash: v.string(), expiresAt: v.number() },
  handler: async (ctx, { secret, email, tokenHash, expiresAt }) => {
    requireServer(secret);
    const lower = email.toLowerCase();
    // Invalidate any outstanding token first: requesting a new link must revoke
    // the previous one, otherwise an old email stays usable until it expires.
    const pending = await ctx.db.query("password_reset").collect();
    for (const r of pending) {
      if (r.email.toLowerCase() === lower && r.used === 0) {
        await ctx.db.patch(r._id, { used: 1 });
      }
    }
    await ctx.db.insert("password_reset", {
      email: lower,
      tokenHash,
      expiresAt,
      used: 0,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Single call that validates AND burns the token, so the check and the
// consumption cannot interleave: Convex mutations are transactional, whereas the
// previous SELECT-then-UPDATE left a window for the same link to be used twice.
export const consume = mutation({
  args: { secret: v.string(), tokenHash: v.string() },
  handler: async (ctx, { secret, tokenHash }) => {
    requireServer(secret);
    // Flat shape rather than a discriminated union: Convex return types cross a
    // serialization boundary and the `ok` narrowing does not survive it, so the
    // caller would have to assert. `email` is null on every failure path.
    const row = await ctx.db
      .query("password_reset")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!row) return { ok: false, email: null, reason: "unknown" };
    if (row.used === 1) return { ok: false, email: null, reason: "used" };
    if (row.expiresAt <= Date.now()) return { ok: false, email: null, reason: "expired" };

    await ctx.db.patch(row._id, { used: 1 });
    // Burn every other outstanding token for the account too.
    const others = await ctx.db.query("password_reset").collect();
    for (const r of others) {
      if (r._id !== row._id && r.email.toLowerCase() === row.email.toLowerCase() && r.used === 0) {
        await ctx.db.patch(r._id, { used: 1 });
      }
    }
    return { ok: true, email: row.email, reason: "ok" };
  },
});
