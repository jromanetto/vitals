import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { BiomarkerTable } from "@/components/biomarker-table";

export const dynamic = "force-dynamic";

async function getLatest() {
  ensureSchema();
  const d = db();
  const rows = await d.run(sql`
    SELECT name, slug, category, value, unit, ref_low, ref_high, MAX(date) as date, source
    FROM biomarker
    GROUP BY slug
    ORDER BY name COLLATE NOCASE
  `) as unknown as { rows?: unknown[] };
  // drizzle better-sqlite3 returns { rows } via .all when using prepared
  return [];
}

export default async function BiomarkersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Biomarkers</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Toutes tes mesures sang, agrégées par marqueur. Cliquez sur un marqueur pour son évolution.
        </p>
      </div>
      <BiomarkerTable />
    </div>
  );
}
