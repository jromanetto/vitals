// Chat domain — sessions, messages, memory. Owner-scoped (no Foyer view-as: the
// legacy route reads/writes by the session user only). All secret-gated.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

// --- sessions ---
export const listSessions = query({
  args: { secret: v.string(), authUserId: v.number() },
  handler: async (ctx, { secret, authUserId }) => {
    requireServer(secret);
    const rows = await ctx.db.query("chat_session").withIndex("by_user", (q) => q.eq("userId", authUserId)).collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return { rows: rows.map((s) => ({ id: s.legacyId, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt })) };
  },
});

export const createSession = mutation({
  args: { secret: v.string(), authUserId: v.number(), title: v.string() },
  handler: async (ctx, { secret, authUserId, title }) => {
    requireServer(secret);
    const now = Date.now();
    await ctx.db.insert("chat_session", { legacyId: now, userId: authUserId, title, createdAt: now, updatedAt: now });
    return { id: now };
  },
});

// Owner of a session (for the route's isolation check). Returns null if absent.
export const sessionOwner = query({
  args: { secret: v.string(), sessionId: v.number() },
  handler: async (ctx, { secret, sessionId }) => {
    requireServer(secret);
    const s = await ctx.db.query("chat_session").filter((q) => q.eq(q.field("legacyId"), sessionId)).first();
    return { userId: s ? s.userId : null, title: s ? s.title : null };
  },
});

export const renameSession = mutation({
  args: { secret: v.string(), authUserId: v.number(), sessionId: v.number(), title: v.string() },
  handler: async (ctx, { secret, authUserId, sessionId, title }) => {
    requireServer(secret);
    const s = await ctx.db.query("chat_session").withIndex("by_user", (q) => q.eq("userId", authUserId)).filter((q) => q.eq(q.field("legacyId"), sessionId)).first();
    if (s) await ctx.db.patch(s._id, { title, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const touchSession = mutation({
  args: { secret: v.string(), sessionId: v.number() },
  handler: async (ctx, { secret, sessionId }) => {
    requireServer(secret);
    const s = await ctx.db.query("chat_session").filter((q) => q.eq(q.field("legacyId"), sessionId)).first();
    if (s) await ctx.db.patch(s._id, { updatedAt: Date.now() });
    return { ok: true };
  },
});

export const deleteSession = mutation({
  args: { secret: v.string(), authUserId: v.number(), sessionId: v.number() },
  handler: async (ctx, { secret, authUserId, sessionId }) => {
    requireServer(secret);
    const s = await ctx.db.query("chat_session").withIndex("by_user", (q) => q.eq("userId", authUserId)).filter((q) => q.eq(q.field("legacyId"), sessionId)).first();
    if (!s) return { ok: false };
    // cascade messages
    const msgs = await ctx.db.query("chat_message").withIndex("by_session", (q) => q.eq("sessionLegacyId", sessionId)).collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(s._id);
    return { ok: true };
  },
});

// --- messages ---
export const listMessages = query({
  args: { secret: v.string(), sessionId: v.number(), order: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { secret, sessionId, order, limit }) => {
    requireServer(secret);
    const rows = await ctx.db.query("chat_message").withIndex("by_session", (q) => q.eq("sessionLegacyId", sessionId)).collect();
    // legacy ordered by id; legacyId is monotonic per insert (Date.now()+i)
    rows.sort((a, b) => a.legacyId - b.legacyId);
    const ordered = order === "desc" ? rows.slice().reverse() : rows;
    const capped = limit ? ordered.slice(0, limit) : ordered;
    return { rows: capped.map((m) => ({ id: m.legacyId, role: m.role, content: m.content, sources: m.sources ?? null, createdAt: m.createdAt })) };
  },
});

export const insertMessage = mutation({
  args: { secret: v.string(), authUserId: v.number(), sessionId: v.number(), role: v.string(), content: v.string(), sources: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { secret, authUserId, sessionId, role, content, sources }) => {
    requireServer(secret);
    const legacyId = Date.now();
    await ctx.db.insert("chat_message", { legacyId, userId: authUserId, sessionLegacyId: sessionId, role, content, sources: sources ?? undefined, createdAt: legacyId });
    return { id: legacyId };
  },
});

export const countMessages = query({
  args: { secret: v.string(), sessionId: v.number() },
  handler: async (ctx, { secret, sessionId }) => {
    requireServer(secret);
    const rows = await ctx.db.query("chat_message").withIndex("by_session", (q) => q.eq("sessionLegacyId", sessionId)).collect();
    return { count: rows.length };
  },
});

// --- memory ---
export const listMemory = query({
  args: { secret: v.string(), authUserId: v.number(), activeOnly: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, { secret, authUserId, activeOnly, limit }) => {
    requireServer(secret);
    let rows = await ctx.db.query("chat_memory").withIndex("by_user", (q) => q.eq("userId", authUserId)).collect();
    if (activeOnly) rows = rows.filter((m) => m.active === 1);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    if (limit) rows = rows.slice(0, limit);
    return { rows: rows.map((m) => ({ id: m.legacyId, kind: m.kind, body: m.body, sourceSessionId: m.sourceSessionId ?? null, confidence: m.confidence ?? null, active: m.active, createdAt: m.createdAt })) };
  },
});

export const memoryExists = query({
  args: { secret: v.string(), authUserId: v.number(), kind: v.string(), body: v.string() },
  handler: async (ctx, { secret, authUserId, kind, body }) => {
    requireServer(secret);
    const rows = await ctx.db.query("chat_memory").withIndex("by_user", (q) => q.eq("userId", authUserId)).collect();
    return { exists: rows.some((m) => m.kind === kind && m.body === body) };
  },
});

export const insertMemory = mutation({
  args: { secret: v.string(), authUserId: v.number(), kind: v.string(), body: v.string(), sourceSessionId: v.optional(v.union(v.number(), v.null())), confidence: v.optional(v.union(v.number(), v.null())) },
  handler: async (ctx, { secret, authUserId, kind, body, sourceSessionId, confidence }) => {
    requireServer(secret);
    const legacyId = Date.now();
    await ctx.db.insert("chat_memory", { legacyId, userId: authUserId, kind, body, sourceSessionId: sourceSessionId ?? undefined, confidence: confidence ?? undefined, active: 1, createdAt: legacyId });
    return { id: legacyId };
  },
});

// In-place content edit (preserves legacyId + createdAt; unlike delete+insert).
export const updateMemory = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number(), kind: v.optional(v.string()), body: v.optional(v.string()), confidence: v.optional(v.union(v.number(), v.null())) },
  handler: async (ctx, { secret, authUserId, id, kind, body, confidence }) => {
    requireServer(secret);
    const m = await ctx.db.query("chat_memory").withIndex("by_user", (q) => q.eq("userId", authUserId)).filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (!m) return { ok: false };
    const patch: Record<string, unknown> = {};
    if (kind !== undefined) patch.kind = kind;
    if (body !== undefined) patch.body = body;
    if (confidence !== undefined) patch.confidence = confidence ?? undefined;
    await ctx.db.patch(m._id, patch);
    return { ok: true };
  },
});

export const setMemoryActive = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number(), active: v.boolean() },
  handler: async (ctx, { secret, authUserId, id, active }) => {
    requireServer(secret);
    const m = await ctx.db.query("chat_memory").withIndex("by_user", (q) => q.eq("userId", authUserId)).filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (m) await ctx.db.patch(m._id, { active: active ? 1 : 0 });
    return { ok: true };
  },
});

export const deleteMemory = mutation({
  args: { secret: v.string(), authUserId: v.number(), id: v.number() },
  handler: async (ctx, { secret, authUserId, id }) => {
    requireServer(secret);
    const m = await ctx.db.query("chat_memory").withIndex("by_user", (q) => q.eq("userId", authUserId)).filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (m) await ctx.db.delete(m._id);
    return { ok: true };
  },
});
