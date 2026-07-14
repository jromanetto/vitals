// One-shot migration ETL endpoints (SQLite -> Convex).
// Secret-gated: the loader passes MIGRATION_SECRET (set on the deployment via
// `npx convex env set MIGRATION_SECRET ...`). Delete this file after the
// migration is complete — it is a generic write surface and must not ship.
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function assertSecret(provided: string) {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || provided !== expected) {
    throw new Error("etl: bad or missing MIGRATION_SECRET");
  }
}

export const insertBatch = mutation({
  args: { secret: v.string(), table: v.string(), rows: v.array(v.any()) },
  handler: async (ctx, { secret, table, rows }) => {
    assertSecret(secret);
    let n = 0;
    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.db.insert(table as any, row);
      n++;
    }
    return { inserted: n };
  },
});

// Idempotent re-run helper: deletes up to `limit` docs per call (bounded to stay
// under Convex's per-execution read/write limits). The client loops until
// `remaining` is false. limit must be <= 4000.
export const wipeTable = mutation({
  args: { secret: v.string(), table: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { secret, table, limit }) => {
    assertSecret(secret);
    const cap = Math.min(limit ?? 2000, 4000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = await ctx.db.query(table as any).take(cap);
    for (const doc of docs) await ctx.db.delete(doc._id);
    return { deleted: docs.length, remaining: docs.length === cap };
  },
});

// Paginated count — the client accumulates page lengths across cursors so we can
// count tables larger than the per-execution read limit.
export const countPage = query({
  args: { secret: v.string(), table: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { secret, table, cursor }) => {
    assertSecret(secret);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await ctx.db.query(table as any).paginate({ cursor, numItems: 2000 });
    return { count: r.page.length, cursor: r.continueCursor, isDone: r.isDone };
  },
});
