// Server-bridge auth for Convex domain functions (interim, until Phase 8 moves
// auth to Convex Auth for direct browser access + reactivity).
//
// The Next.js layer holds iron-session and is the ONLY trusted caller: it proves
// the authenticated user server-side, then calls these public Convex functions
// with SERVER_BRIDGE_SECRET. The browser cannot forge calls (it lacks the
// secret). When auth migrates to Convex, swap requireServer(...) for
// ctx.auth.getUserIdentity() and the function bodies stay identical.
import type { QueryCtx } from "../_generated/server";

export function requireServer(secret: string): void {
  const expected = process.env.SERVER_BRIDGE_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("bridge: bad or missing SERVER_BRIDGE_SECRET");
  }
}

// Foyer invariant, mirrored from lib/auth.ts:
// - WRITES always scope to authUserId (never the viewed member) -> read-only view.
// - READS resolve to a viewed member ONLY via an ACTIVE household_link; a missing
//   or pending link falls back to self. Fail-closed.
export async function resolveReadUser(
  ctx: QueryCtx,
  authUserId: number,
  viewUserId: number | null | undefined
): Promise<number> {
  if (viewUserId == null || viewUserId === authUserId) return authUserId;
  const link = await ctx.db
    .query("household_link")
    .withIndex("by_pair", (q) =>
      q.eq("viewerUserId", authUserId).eq("subjectUserId", viewUserId)
    )
    .first();
  return link && link.status === "active" ? viewUserId : authUserId;
}
