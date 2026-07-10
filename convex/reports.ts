// Reports / blood-reports / action-plans. Generated content; body stored verbatim
// (routes render/handle any formatting). Reads resolve via Foyer (read-only view),
// writes scope to self — EXCEPT the async worker status flip (updateReport), which
// is secret-only and targets a legacyId (the VPS report worker calls it).
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reportToClient(d: any) {
  return { id: d.legacyId, kind: d.kind, title: d.title, body: d.body, meta: d.meta ?? null, createdAt: d.createdAt, status: d.status ?? null };
}

export const list = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()), kind: v.optional(v.string()) },
  handler: async (ctx, { secret, authUserId, viewUserId, kind }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    let rows = await ctx.db.query("report").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    if (kind) rows = rows.filter((r) => r.kind === kind);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return { rows: rows.map(reportToClient) };
  },
});

export const get = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()), id: v.number() },
  handler: async (ctx, { secret, authUserId, viewUserId, id }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const doc = await ctx.db.query("report").withIndex("by_user", (q) => q.eq("userId", userId)).filter((q) => q.eq(q.field("legacyId"), id)).first();
    return { row: doc ? reportToClient(doc) : null };
  },
});

export const latestByKind = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()), kind: v.string() },
  handler: async (ctx, { secret, authUserId, viewUserId, kind }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const rows = await ctx.db.query("report").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const latest = rows.filter((r) => r.kind === kind).sort((a, b) => b.createdAt - a.createdAt)[0];
    return { row: latest ? reportToClient(latest) : null };
  },
});

export const insert = mutation({
  args: {
    secret: v.string(), authUserId: v.number(), kind: v.string(), title: v.string(),
    body: v.string(), meta: v.optional(v.union(v.string(), v.null())), status: v.optional(v.string()),
  },
  handler: async (ctx, { secret, authUserId, kind, title, body, meta, status }) => {
    requireServer(secret);
    const legacyId = Date.now();
    await ctx.db.insert("report", {
      legacyId, userId: authUserId, kind, title, body,
      meta: meta ?? undefined, status: status ?? undefined, createdAt: legacyId,
    });
    return { id: legacyId };
  },
});

// Async worker status/body flip (pending -> done). Secret-only, by legacyId.
export const updateReport = mutation({
  args: { secret: v.string(), id: v.number(), status: v.optional(v.string()), body: v.optional(v.string()), title: v.optional(v.string()), meta: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { secret, id, status, body, title, meta }) => {
    requireServer(secret);
    const doc = await ctx.db.query("report").filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (!doc) return { ok: false, notFound: true };
    const patch: Record<string, unknown> = {};
    if (status !== undefined) patch.status = status;
    if (body !== undefined) patch.body = body;
    if (title !== undefined) patch.title = title;
    if (meta !== undefined) patch.meta = meta ?? undefined;
    await ctx.db.patch(doc._id, patch);
    return { ok: true };
  },
});

export const remove = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number() },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const doc = await ctx.db.query("report").withIndex("by_user", (q) => q.eq("userId", authUserId)).filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (doc) await ctx.db.delete(doc._id);
    return { ok: true };
  },
});

// --- blood_report ---
export const bloodReports = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()) },
  handler: async (ctx, { secret, authUserId, viewUserId }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const rows = await ctx.db.query("blood_report").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    rows.sort((a, b) => b.panelDate - a.panelDate);
    return { rows: rows.map((d) => ({ id: d.legacyId, panelDate: d.panelDate, body: d.body, generatedAt: d.generatedAt })) };
  },
});

export const upsertBloodReport = mutation({
  args: { secret: v.string(), authUserId: v.number(), panelDate: v.number(), body: v.string(), generatedAt: v.number() },
  handler: async (ctx, { secret, authUserId, panelDate, body, generatedAt }) => {
    requireServer(secret);
    const existing = await ctx.db.query("blood_report").withIndex("by_user", (q) => q.eq("userId", authUserId)).filter((q) => q.eq(q.field("panelDate"), panelDate)).first();
    if (existing) { await ctx.db.patch(existing._id, { body, generatedAt }); return { id: existing.legacyId }; }
    const legacyId = Date.now();
    await ctx.db.insert("blood_report", { legacyId, userId: authUserId, panelDate, body, generatedAt });
    return { id: legacyId };
  },
});

// --- action_plan ---
export const latestActionPlan = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()) },
  handler: async (ctx, { secret, authUserId, viewUserId }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const rows = await ctx.db.query("action_plan").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const latest = rows.sort((a, b) => b.createdAt - a.createdAt)[0];
    return { row: latest ? { id: latest.legacyId, plan: latest.plan, createdAt: latest.createdAt } : null };
  },
});

export const insertActionPlan = mutation({
  args: { secret: v.string(), authUserId: v.number(), plan: v.string() },
  handler: async (ctx, { secret, authUserId, plan }) => {
    requireServer(secret);
    const legacyId = Date.now();
    await ctx.db.insert("action_plan", { legacyId, userId: authUserId, plan, createdAt: legacyId });
    return { id: legacyId };
  },
});
