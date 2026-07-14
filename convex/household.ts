// Household / Foyer consent links. This is the source of truth for view-as:
// convex/lib/auth.ts resolveReadUser reads these, so writes MUST land here (not
// SQLite) or the isolation check never matches. All secret-gated.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

export const hasActiveLink = query({
  args: { secret: v.string(), viewerId: v.number(), subjectId: v.number() },
  handler: async (ctx, { secret, viewerId, subjectId }) => {
    requireServer(secret);
    const link = await ctx.db
      .query("household_link")
      .withIndex("by_pair", (q) => q.eq("viewerUserId", viewerId).eq("subjectUserId", subjectId))
      .first();
    return { active: !!link && link.status === "active" };
  },
});

// Active members the viewer can consult (for the switcher). JOINs user for label/email.
export const canView = query({
  args: { secret: v.string(), userId: v.number() },
  handler: async (ctx, { secret, userId }) => {
    requireServer(secret);
    const links = await ctx.db
      .query("household_link")
      .withIndex("by_viewer", (q) => q.eq("viewerUserId", userId))
      .collect();
    const out: Array<{ id: number; label: string; email: string }> = [];
    for (const h of links.filter((l) => l.status === "active")) {
      const u = await ctx.db.query("user").withIndex("by_legacy", (q) => q.eq("legacyId", h.subjectUserId)).first();
      out.push({ id: h.subjectUserId, label: h.label || (u?.email ?? ""), email: u?.email ?? "" });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return { rows: out };
  },
});

// Full household view: members, outgoing pending, incoming pending (consent inbox).
export const list = query({
  args: { secret: v.string(), userId: v.number() },
  handler: async (ctx, { secret, userId }) => {
    requireServer(secret);
    const outgoingLinks = await ctx.db.query("household_link").withIndex("by_viewer", (q) => q.eq("viewerUserId", userId)).collect();
    const outgoing = [];
    for (const h of outgoingLinks) {
      const u = await ctx.db.query("user").withIndex("by_legacy", (q) => q.eq("legacyId", h.subjectUserId)).first();
      outgoing.push({ id: h.legacyId ?? 0, otherId: h.subjectUserId, label: h.label || (u?.email ?? ""), email: u?.email ?? "", relationship: h.relationship ?? null, status: h.status, created_at: h.createdAt });
    }
    outgoing.sort((a, b) => a.label.localeCompare(b.label));

    const incomingLinks = await ctx.db.query("household_link").withIndex("by_subject", (q) => q.eq("subjectUserId", userId)).collect();
    const pendingIncoming = [];
    for (const h of incomingLinks.filter((l) => l.status === "pending")) {
      const u = await ctx.db.query("user").withIndex("by_legacy", (q) => q.eq("legacyId", h.viewerUserId)).first();
      pendingIncoming.push({ id: h.legacyId ?? 0, otherId: h.viewerUserId, email: u?.email ?? "", relationship: h.relationship ?? null, created_at: h.createdAt });
    }
    pendingIncoming.sort((a, b) => b.created_at - a.created_at);

    return {
      canView: outgoing.filter((o) => o.status === "active"),
      pendingOutgoing: outgoing.filter((o) => o.status === "pending"),
      pendingIncoming,
    };
  },
});

export const findUserByEmail = query({
  args: { secret: v.string(), email: v.string() },
  handler: async (ctx, { secret, email }) => {
    requireServer(secret);
    const u = await ctx.db.query("user").withIndex("by_email", (q) => q.eq("email", email)).first();
    return { id: u ? u.legacyId : null };
  },
});

// Viewer requests to view subject's data (creates a pending link).
export const request = mutation({
  args: { secret: v.string(), viewerId: v.number(), subjectId: v.number(), label: v.union(v.string(), v.null()), relationship: v.union(v.string(), v.null()) },
  handler: async (ctx, { secret, viewerId, subjectId, label, relationship }) => {
    requireServer(secret);
    const existing = await ctx.db.query("household_link").withIndex("by_pair", (q) => q.eq("viewerUserId", viewerId).eq("subjectUserId", subjectId)).first();
    if (existing) return { ok: false, reason: "exists" };
    const now = Date.now();
    await ctx.db.insert("household_link", { legacyId: now, viewerUserId: viewerId, subjectUserId: subjectId, label: label ?? undefined, relationship: relationship ?? undefined, status: "pending", createdAt: now });
    return { ok: true, id: now };
  },
});

// Subject approves/rejects a pending request where they are the subject (consent gate).
export const respond = mutation({
  args: { secret: v.string(), subjectId: v.number(), id: v.number(), approve: v.boolean() },
  handler: async (ctx, { secret, subjectId, id, approve }) => {
    requireServer(secret);
    const link = await ctx.db.query("household_link").withIndex("by_subject", (q) => q.eq("subjectUserId", subjectId)).filter((q) => q.and(q.eq(q.field("legacyId"), id), q.eq(q.field("status"), "pending"))).first();
    if (!link) return { ok: false, notFound: true };
    if (approve) await ctx.db.patch(link._id, { status: "active", respondedAt: Date.now() });
    else await ctx.db.delete(link._id);
    return { ok: true };
  },
});

// Either party severs the link.
export const remove = mutation({
  args: { secret: v.string(), userId: v.number(), id: v.number() },
  handler: async (ctx, { secret, userId, id }) => {
    requireServer(secret);
    const link = await ctx.db.query("household_link").filter((q) => q.eq(q.field("legacyId"), id)).first();
    if (!link || (link.viewerUserId !== userId && link.subjectUserId !== userId)) return { ok: false, notFound: true };
    await ctx.db.delete(link._id);
    return { ok: true };
  },
});
