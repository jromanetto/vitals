// Profile + nutrition preferences. profile.data is a field-encrypted JSON blob
// stored VERBATIM (routes decrypt with the field key, which never reaches Convex).
// Reads resolve via Foyer (read-only view); writes scope to self.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

export const get = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()) },
  handler: async (ctx, { secret, authUserId, viewUserId }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const rows = await ctx.db.query("profile").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const latest = rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { data: latest ? latest.data : null, updatedAt: latest ? latest.updatedAt : null };
  },
});

// Upsert the single latest profile row for the user (writes to self only). The
// route encrypts sensitive fields before calling.
export const upsert = mutation({
  args: { secret: v.string(), authUserId: v.number(), data: v.string() },
  handler: async (ctx, { secret, authUserId, data }) => {
    requireServer(secret);
    const now = Date.now();
    const existing = await ctx.db.query("profile").withIndex("by_user", (q) => q.eq("userId", authUserId)).collect();
    const latest = existing.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) { await ctx.db.patch(latest._id, { data, updatedAt: now }); return { id: latest.legacyId }; }
    const legacyId = now;
    await ctx.db.insert("profile", { legacyId, userId: authUserId, data, updatedAt: now });
    return { id: legacyId };
  },
});

// Delete a user's profile rows (account deletion / GDPR erasure; also used to
// clean up the encryption script's round-trip probe). Scoped to self.
export const removeForUser = mutation({
  args: { secret: v.string(), authUserId: v.number() },
  handler: async (ctx, { secret, authUserId }) => {
    requireServer(secret);
    const rows = await ctx.db.query("profile").withIndex("by_user", (q) => q.eq("userId", authUserId)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return { deleted: rows.length };
  },
});

// --- nutrition_pref ---
export const nutritionPref = query({
  args: { secret: v.string(), authUserId: v.number(), viewUserId: v.optional(v.number()) },
  handler: async (ctx, { secret, authUserId, viewUserId }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const rows = await ctx.db.query("nutrition_pref").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const latest = rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!latest) return { row: null };
    return { row: { dietType: latest.dietType, allergies: latest.allergies, aversions: latest.aversions, budget: latest.budget, cuisines: latest.cuisines, updatedAt: latest.updatedAt } };
  },
});

export const upsertNutritionPref = mutation({
  args: {
    secret: v.string(), authUserId: v.number(),
    dietType: v.string(), allergies: v.string(), aversions: v.string(), budget: v.string(), cuisines: v.string(),
  },
  handler: async (ctx, { secret, authUserId, dietType, allergies, aversions, budget, cuisines }) => {
    requireServer(secret);
    const now = Date.now();
    const fields = { dietType, allergies, aversions, budget, cuisines, updatedAt: now };
    const existing = await ctx.db.query("nutrition_pref").withIndex("by_user", (q) => q.eq("userId", authUserId)).collect();
    const latest = existing.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) { await ctx.db.patch(latest._id, fields); return { id: latest.legacyId }; }
    const legacyId = now;
    await ctx.db.insert("nutrition_pref", { legacyId, userId: authUserId, ...fields });
    return { id: legacyId };
  },
});
