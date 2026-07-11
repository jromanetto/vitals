/**
 * Recompute dna_insight for a user from their already-stored dna_variant
 * genotypes against the CURRENT catalog — no genome file required.
 *
 * dna_insight rows are snapshots of the catalog taken at ingest time, so a
 * catalog correction (a fixed risk genotype, a reworded summary) doesn't reach
 * existing users until their insights are re-derived. Previously that meant a
 * hand-written SQL backfill; this does it from data already in the DB.
 *
 * Scoped wipe + rebuild, fully user_id-isolated.
 */
import { db } from "../db";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { CATALOG, evaluate } from "./catalog";

// dna_variant is read from SQLite (deferred, stays); dna_insight is wiped +
// rebuilt in Convex. Scoped to the given user.
export async function rederiveDnaInsights(userId: number): Promise<{ insights: number }> {
  const sqlite = db().$client;
  const rsids = [...new Set(CATALOG.map((c) => c.rsid))];
  const placeholders = rsids.map(() => "?").join(",");
  const rows = sqlite
    .prepare(`SELECT rsid, genotype FROM dna_variant WHERE user_id = ? AND rsid IN (${placeholders})`)
    .all(userId, ...rsids) as Array<{ rsid: string; genotype: string }>;
  const geno = new Map(rows.map((r) => [r.rsid, r.genotype]));
  // No genome stored for this user → nothing to derive; leave existing rows untouched.
  if (geno.size === 0) return { insights: 0 };

  const insightRows: Array<{ rsid: string; category: string; trait: string; effect: string | null; magnitude: number | null; riskAllele: string | null; userGenotype: string | null; hasRisk: number; isProtective: number; summary: string | null; source: string | null }> = [];
  for (const cat of CATALOG) {
    const ug = geno.get(cat.rsid);
    if (!ug) continue;
    const ev = evaluate(cat, ug);
    insightRows.push({
      rsid: cat.rsid, category: cat.category, trait: cat.trait, effect: cat.effect ?? null,
      magnitude: cat.magnitude ?? null, riskAllele: cat.riskGenotypes.join(",") || null,
      userGenotype: ug, hasRisk: ev.hasRisk ? 1 : 0, isProtective: ev.isProtective ? 1 : 0,
      summary: cat.summary ?? null, source: cat.source ?? null,
    });
  }
  const convex = convexServer();
  const secret = bridgeSecret();
  await convex.mutation(api.dna.wipeInsights, { secret, authUserId: userId });
  if (insightRows.length) {
    await convex.mutation(api.dna.insertInsights, { secret, authUserId: userId, rows: insightRows });
  }
  return { insights: insightRows.length };
}
