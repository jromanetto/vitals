// The `user` table — identity. This is the last table whose writes still lived
// in the local SQLite file on the VPS, which made login depend on a single
// unreplicated disk. Everything here is secret-gated: the Next.js layer holds
// iron-session and is the only trusted caller (see convex/lib/auth.ts).
//
// `legacyId` is the user id used everywhere else in the schema (biomarker.userId,
// household_link.viewerUserId, the iron-session cookie, the Convex JWT `sub`).
// It is the identity, not a migration artifact, so new users get a real one.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

// Full record including the bcrypt hash. Only ever called from the server bridge
// during credential verification — never expose this to the browser.
export const byEmail = query({
  args: { secret: v.string(), email: v.string() },
  handler: async (ctx, { secret, email }) => {
    requireServer(secret);
    const u = await ctx.db
      .query("user")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!u) return { user: null };
    return { user: { id: u.legacyId, email: u.email, hash: u.hash, role: u.role ?? "beta" } };
  },
});

// Identity lookup without the hash, for the paths that only need "does this
// account exist" or "what is this email's id" (legacy sessions, forgot-password).
export const idByEmail = query({
  args: { secret: v.string(), email: v.string() },
  handler: async (ctx, { secret, email }) => {
    requireServer(secret);
    const u = await ctx.db
      .query("user")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    return { id: u?.legacyId ?? null };
  },
});

export const existsByLegacyId = query({
  args: { secret: v.string(), legacyId: v.number() },
  handler: async (ctx, { secret, legacyId }) => {
    requireServer(secret);
    const u = await ctx.db
      .query("user")
      .withIndex("by_legacy", (q) => q.eq("legacyId", legacyId))
      .first();
    return { exists: !!u };
  },
});

// Drives the beta capacity gate in lib/beta.ts. Excludes the seeded demo
// account (legacyId 999), which is not a real signup and must not eat a slot.
export const count = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireServer(secret);
    const all = await ctx.db.query("user").collect();
    return { count: all.filter((u) => u.legacyId !== 999).length };
  },
});

// Role gate for the admin surfaces (feedback inbox).
export const roleByLegacyId = query({
  args: { secret: v.string(), legacyId: v.number() },
  handler: async (ctx, { secret, legacyId }) => {
    requireServer(secret);
    const u = await ctx.db
      .query("user")
      .withIndex("by_legacy", (q) => q.eq("legacyId", legacyId))
      .first();
    return { role: u?.role ?? null };
  },
});

// Recipients for the weekly digest cron. Ordered by id so the cron processes
// accounts deterministically.
export const listAll = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireServer(secret);
    const all = await ctx.db.query("user").collect();
    return {
      rows: all
        .map((u) => ({ id: u.legacyId, email: u.email }))
        .sort((a, b) => a.id - b.id),
    };
  },
});

export const create = mutation({
  args: {
    secret: v.string(),
    email: v.string(),
    hash: v.string(),
    userSecret: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { secret, email, hash, userSecret, role }) => {
    requireServer(secret);
    const lower = email.toLowerCase();
    const existing = await ctx.db
      .query("user")
      .withIndex("by_email", (q) => q.eq("email", lower))
      .first();
    // Race guard: the route checks for a duplicate before hashing the password,
    // but two concurrent signups on the same email would both pass that check.
    if (existing) return { id: existing.legacyId, created: false };

    // Mirrors SQLite AUTOINCREMENT. Cheap to scan: this table holds one row per
    // human, not per event.
    const all = await ctx.db.query("user").collect();
    const nextId = all.reduce((max, u) => Math.max(max, u.legacyId), 0) + 1;

    await ctx.db.insert("user", {
      legacyId: nextId,
      email: lower,
      hash,
      secret: userSecret,
      role: role ?? "beta",
      createdAt: Date.now(),
    });
    return { id: nextId, created: true };
  },
});

export const setPasswordHash = mutation({
  args: { secret: v.string(), email: v.string(), hash: v.string() },
  handler: async (ctx, { secret, email, hash }) => {
    requireServer(secret);
    const u = await ctx.db
      .query("user")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!u) return { ok: false };
    await ctx.db.patch(u._id, { hash });
    return { ok: true };
  },
});
