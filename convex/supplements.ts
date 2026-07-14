// Supplements domain — first vertical slice migrated to Convex.
// Response shapes match the legacy /api/supplements + /api/supplements/log
// contracts (client keeps using the integer `legacyId` as `id`).
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

const SUPPLEMENT_FIELDS = [
  "name", "dose", "unit", "timing", "frequency", "startedAt", "endedAt",
  "notes", "targetBiomarker", "targetSnp", "url", "brand", "imageUrl",
  "ingredients", "servingSize", "suggestedUse", "price", "duration", "createdAt",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClient(doc: any) {
  const out: Record<string, unknown> = { id: doc.legacyId };
  for (const f of SUPPLEMENT_FIELDS) out[f] = doc[f] ?? null;
  return out;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/supplements  -> { rows, takenToday }
export const list = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()) },
  handler: async (ctx, { secret, authUserId, viewUserId }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const supps = await ctx.db
      .query("supplement")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // active first (endedAt null), then by name
    supps.sort((a, b) => {
      const ae = a.endedAt == null ? 0 : 1;
      const be = b.endedAt == null ? 0 : 1;
      if (ae !== be) return ae - be;
      return (a.name || "").localeCompare(b.name || "");
    });
    const today = todayIso();
    const logs = await ctx.db
      .query("supplement_log")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const takenToday = logs
      .filter((l) => l.date === today && l.taken === 1)
      .map((l) => l.supplementLegacyId);
    return { rows: supps.map(toClient), takenToday };
  },
});

// Reactive variant for the browser: authenticated via the custom JWT (ctx.auth),
// NOT the server-bridge secret. Self-scoped (the JWT sub is the user). Same shape
// as `list`. Used by useQuery on the client for live updates.
export const listLive = query({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.auth.getUserIdentity();
    if (!id) return { rows: [], takenToday: [] };
    const userId = Number(id.subject);
    const supps = await ctx.db.query("supplement").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    supps.sort((a, b) => {
      const ae = a.endedAt == null ? 0 : 1, be = b.endedAt == null ? 0 : 1;
      if (ae !== be) return ae - be;
      return (a.name || "").localeCompare(b.name || "");
    });
    const today = todayIso();
    const logs = await ctx.db.query("supplement_log").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const takenToday = logs.filter((l) => l.date === today && l.taken === 1).map((l) => l.supplementLegacyId);
    return { rows: supps.map(toClient), takenToday };
  },
});

// POST /api/supplements  (create or update; writes always scope to authUserId)
export const upsert = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    id: v.optional(v.number()), // legacyId when updating
    name: v.string(),
    dose: v.optional(v.union(v.string(), v.null())),
    unit: v.optional(v.union(v.string(), v.null())),
    timing: v.optional(v.union(v.string(), v.null())),
    frequency: v.optional(v.union(v.string(), v.null())),
    startedAt: v.optional(v.union(v.number(), v.null())),
    endedAt: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    targetBiomarker: v.optional(v.union(v.string(), v.null())),
    targetSnp: v.optional(v.union(v.string(), v.null())),
    url: v.optional(v.union(v.string(), v.null())),
    brand: v.optional(v.union(v.string(), v.null())),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    ingredients: v.optional(v.union(v.string(), v.null())),
    servingSize: v.optional(v.union(v.string(), v.null())),
    suggestedUse: v.optional(v.union(v.string(), v.null())),
    price: v.optional(v.union(v.string(), v.null())),
    duration: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    requireServer(args.secret);
    const userId = args.authUserId;
    const fields = {
      name: args.name,
      dose: args.dose ?? undefined,
      unit: args.unit ?? undefined,
      timing: args.timing ?? undefined,
      frequency: args.frequency ?? undefined,
      startedAt: args.startedAt ?? undefined,
      endedAt: args.endedAt ?? undefined,
      notes: args.notes ?? undefined,
      targetBiomarker: args.targetBiomarker ?? undefined,
      targetSnp: args.targetSnp ?? undefined,
      url: args.url ?? undefined,
      brand: args.brand ?? undefined,
      imageUrl: args.imageUrl ?? undefined,
      ingredients: args.ingredients ?? undefined,
      servingSize: args.servingSize ?? undefined,
      suggestedUse: args.suggestedUse ?? undefined,
      price: args.price ?? undefined,
      duration: args.duration ?? undefined,
    };
    if (args.id != null) {
      const existing = await ctx.db
        .query("supplement")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("legacyId"), args.id))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, fields);
        return { ok: true, id: args.id };
      }
    }
    const legacyId = args.id ?? Date.now();
    await ctx.db.insert("supplement", {
      legacyId,
      userId,
      ...fields,
      createdAt: Date.now(),
      startedAt: args.startedAt ?? Date.now(),
    });
    return { ok: true, id: legacyId };
  },
});

// DELETE /api/supplements?id=
export const remove = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number() },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const doc = await ctx.db
      .query("supplement")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) => q.eq(q.field("legacyId"), id))
      .first();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});

// POST /api/supplements/log
export const setLog = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    supplementId: v.number(),
    date: v.optional(v.string()),
    taken: v.boolean(),
  },
  handler: async (ctx, { secret, authUserId, supplementId, date, taken }) => {
    requireServer(secret);
    const d = date ?? todayIso();
    const existing = await ctx.db
      .query("supplement_log")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .filter((q) =>
        q.and(q.eq(q.field("supplementLegacyId"), supplementId), q.eq(q.field("date"), d))
      )
      .first();
    if (taken) {
      if (existing) await ctx.db.patch(existing._id, { taken: 1 });
      else await ctx.db.insert("supplement_log", { legacyId: Date.now(), userId: authUserId, supplementLegacyId: supplementId, date: d, taken: 1 });
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});

// GET /api/supplements/log  -> per-supplement history or all-taken-since
export const logHistory = query({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    viewUserId: v.optional(v.number()),
    supplementId: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, { secret, authUserId, viewUserId, supplementId, days }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const since = new Date(Date.now() - Math.min(3650, days ?? 90) * 86400000)
      .toISOString()
      .slice(0, 10);
    const logs = await ctx.db
      .query("supplement_log")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (supplementId) {
      const rows = logs
        .filter((l) => l.supplementLegacyId === supplementId && l.date >= since)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((l) => ({ date: l.date, taken: l.taken }));
      return { rows };
    }
    const rows = logs
      .filter((l) => l.taken === 1 && l.date >= since)
      .map((l) => ({ supplementId: l.supplementLegacyId, date: l.date }));
    return { rows };
  },
});
