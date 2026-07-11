// Biomarkers domain. Convex returns RAW numeric rows; all meta/range/status
// computation (lib/biomarker-meta, normalize-units) stays in the Next routes.
// biomarker.value is numeric and NOT encrypted (query/sort-critical).
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClient(doc: any) {
  return {
    id: doc.legacyId,
    slug: doc.slug,
    name: doc.name,
    category: doc.category ?? null,
    value: doc.value,
    unit: doc.unit ?? null,
    refLow: doc.refLow ?? null,
    refHigh: doc.refHigh ?? null,
    date: doc.date,
    source: doc.source ?? null,
  };
}

// Raw rows for the resolved read user, optionally filtered to a slug set. Serves
// series / latest / compare — each route does its own shaping.
export const all = query({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    viewUserId: v.optional(v.number()),
    slugs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { secret, authUserId, viewUserId, slugs }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const rows = await ctx.db
      .query("biomarker")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const filtered = slugs && slugs.length ? rows.filter((r) => slugs.includes(r.slug)) : rows;
    filtered.sort((a, b) => a.date - b.date);
    return { rows: filtered.map(toClient) };
  },
});

// Edit a single measurement (writes scope to self). Only provided fields patch.
export const updateMeasurement = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    id: v.number(),
    value: v.optional(v.number()),
    unit: v.optional(v.union(v.string(), v.null())),
    refLow: v.optional(v.union(v.number(), v.null())),
    refHigh: v.optional(v.union(v.number(), v.null())),
    date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireServer(args.secret);
    const doc = await ctx.db
      .query("biomarker")
      .withIndex("by_user", (q) => q.eq("userId", args.authUserId))
      .filter((q) => q.eq(q.field("legacyId"), args.id))
      .first();
    if (!doc) return { ok: false, notFound: true };
    const patch: Record<string, unknown> = {};
    if (args.value !== undefined) patch.value = args.value;
    if (args.unit !== undefined) patch.unit = args.unit ?? undefined;
    if (args.refLow !== undefined) patch.refLow = args.refLow ?? undefined;
    if (args.refHigh !== undefined) patch.refHigh = args.refHigh ?? undefined;
    if (args.date !== undefined) patch.date = args.date;
    if (Object.keys(patch).length === 0) return { ok: false, empty: true };
    await ctx.db.patch(doc._id, patch);
    return { ok: true };
  },
});

export const deleteMeasurement = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number() },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("biomarker")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) => q.eq(q.field("legacyId"), id))
      .first();
    if (!doc) return { ok: false, notFound: true };
    await ctx.db.delete(doc._id);
    return { ok: true };
  },
});

// Bulk insert already-normalized rows (the route does alias lookup + unit
// normalization before calling this). Writes scope to self.
export const insertMany = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    rows: v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        category: v.union(v.string(), v.null()),
        value: v.number(),
        unit: v.union(v.string(), v.null()),
        refLow: v.union(v.number(), v.null()),
        refHigh: v.union(v.number(), v.null()),
        date: v.number(),
        source: v.string(),
        rawText: v.optional(v.union(v.string(), v.null())),
      })
    ),
  },
  handler: async (ctx, { secret, authUserId, rows }) => {
    requireServer(secret);
    let inserted = 0;
    for (const r of rows) {
      await ctx.db.insert("biomarker", {
        legacyId: Date.now() + inserted,
        userId: authUserId,
        name: r.name,
        slug: r.slug,
        category: r.category ?? undefined,
        value: r.value,
        unit: r.unit ?? undefined,
        refLow: r.refLow ?? undefined,
        refHigh: r.refHigh ?? undefined,
        date: r.date,
        source: r.source,
        rawText: r.rawText ?? undefined,
      });
      inserted++;
    }
    return { inserted };
  },
});

// Delete all measurements from a given source file (used on re-ingest to clear
// old rows before reinserting). Scoped to self.
export const deleteBySource = mutation({
  args: { secret: v.string(), authUserId: v.number(), source: v.string() },
  handler: async (ctx, { secret, authUserId, source }) => {
    requireServer(secret);
    const docs = await ctx.db
      .query("biomarker")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) => q.eq(q.field("source"), source))
      .collect();
    for (const d of docs) await ctx.db.delete(d._id);
    return { deleted: docs.length };
  },
});
