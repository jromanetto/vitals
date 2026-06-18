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
import { CATALOG, evaluate } from "./catalog";

export function rederiveDnaInsights(userId: number): { insights: number } {
  const sqlite = db().$client;
  const rsids = [...new Set(CATALOG.map((c) => c.rsid))];
  const placeholders = rsids.map(() => "?").join(",");
  const rows = sqlite
    .prepare(`SELECT rsid, genotype FROM dna_variant WHERE user_id = ? AND rsid IN (${placeholders})`)
    .all(userId, ...rsids) as Array<{ rsid: string; genotype: string }>;
  const geno = new Map(rows.map((r) => [r.rsid, r.genotype]));
  // No genome stored for this user → nothing to derive; leave existing rows untouched.
  if (geno.size === 0) return { insights: 0 };

  const run = sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM dna_insight WHERE user_id = ?`).run(userId);
    const ins = sqlite.prepare(
      `INSERT INTO dna_insight (rsid, category, trait, effect, magnitude, risk_allele, user_genotype, has_risk, is_protective, summary, source, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let n = 0;
    for (const cat of CATALOG) {
      const ug = geno.get(cat.rsid);
      if (!ug) continue;
      const ev = evaluate(cat, ug);
      ins.run(
        cat.rsid, cat.category, cat.trait, cat.effect ?? null, cat.magnitude ?? null,
        cat.riskGenotypes.join(",") || null, ug, ev.hasRisk ? 1 : 0, ev.isProtective ? 1 : 0,
        cat.summary, cat.source, userId,
      );
      n++;
    }
    return n;
  });
  return { insights: run() };
}
