// DNA domain — dna_insight (derived findings) reads migrated to Convex.
// NOTE: dna_variant (1.8M raw SNP rows) is NOT in Convex; those reads stay on
// SQLite (see app/(app)/dna/page.tsx). Only the derived dna_insight table is hot.
//
// Convex returns RAW rows shaped like the legacy SELECT aliases; all grouping,
// carrier exclusion, top/strengths shaping stays in the Next pages (mirrors the
// biomarkers pattern where meta/business logic lives in the route/page).
//
// userGenotype is stored as-is (ENCRYPTED-candidate per schema); this read does
// no decryption — it returns whatever ETL wrote, exactly like the SQLite SELECT.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer, resolveReadUser } from "./lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClient(doc: any) {
  return {
    id: doc.legacyId,
    rsid: doc.rsid,
    category: doc.category,
    trait: doc.trait,
    effect: doc.effect ?? null,
    magnitude: doc.magnitude ?? null,
    riskAllele: doc.riskAllele ?? null,
    userGenotype: doc.userGenotype ?? null,
    hasRisk: doc.hasRisk ?? null,
    isProtective: doc.isProtective ?? null,
    summary: doc.summary ?? null,
    source: doc.source ?? null,
  };
}

// Raw dna_insight rows for the resolved read user, optionally filtered to one
// category. Sorted like the category page's SQL:
//   ORDER BY (has_risk * COALESCE(magnitude,0)) DESC, magnitude DESC NULLS LAST
// The DNA overview page ignores this order and re-sorts its top/strengths.
export const insights = query({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    viewUserId: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { secret, authUserId, viewUserId, category }) => {
    requireServer(secret);
    const userId = await resolveReadUser(ctx, authUserId, viewUserId);
    const raw = await ctx.db
      .query("dna_insight")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const rows = (category ? raw.filter((r) => r.category === category) : raw).map(toClient);
    rows.sort((a, b) => {
      const ra = (a.hasRisk ?? 0) * (a.magnitude ?? 0);
      const rb = (b.hasRisk ?? 0) * (b.magnitude ?? 0);
      if (rb !== ra) return rb - ra;
      // magnitude DESC NULLS LAST
      if (a.magnitude == null && b.magnitude == null) return 0;
      if (a.magnitude == null) return 1;
      if (b.magnitude == null) return -1;
      return b.magnitude - a.magnitude;
    });
    return { rows };
  },
});

// --- writes (ingestion / rederive). Scope to self. ---
export const wipeInsights = mutation({
  args: { secret: v.string(), authUserId: v.number() },
  handler: async (ctx, { secret, authUserId }) => {
    requireServer(secret);
    const rows = await ctx.db.query("dna_insight").withIndex("by_user", (q) => q.eq("userId", authUserId)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return { deleted: rows.length };
  },
});

export const insertInsights = mutation({
  args: {
    secret: v.string(),
    authUserId: v.number(),
    rows: v.array(
      v.object({
        rsid: v.string(),
        category: v.string(),
        trait: v.string(),
        effect: v.union(v.string(), v.null()),
        magnitude: v.union(v.number(), v.null()),
        riskAllele: v.union(v.string(), v.null()),
        userGenotype: v.union(v.string(), v.null()),
        hasRisk: v.number(),
        isProtective: v.number(),
        summary: v.union(v.string(), v.null()),
        source: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (ctx, { secret, authUserId, rows }) => {
    requireServer(secret);
    let i = 0;
    for (const r of rows) {
      await ctx.db.insert("dna_insight", {
        legacyId: Date.now() + i,
        userId: authUserId,
        rsid: r.rsid,
        category: r.category,
        trait: r.trait,
        effect: r.effect ?? undefined,
        magnitude: r.magnitude ?? undefined,
        riskAllele: r.riskAllele ?? undefined,
        userGenotype: r.userGenotype ?? undefined,
        hasRisk: r.hasRisk,
        isProtective: r.isProtective,
        summary: r.summary ?? undefined,
        source: r.source ?? undefined,
      });
      i++;
    }
    return { inserted: rows.length };
  },
});
