// Convex-layer isolation coverage (replaces the SQLite isolation tests that moved
// to Convex). Exercises the real deployed functions where isolation now lives
// (resolveReadUser + household consent + writes-scope-to-self). Runs only when the
// Convex bridge env is present (.env.local); skips cleanly in CI without creds.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

for (const line of (fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : [])) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SECRET = process.env.SERVER_BRIDGE_SECRET;
const skip = !URL || !SECRET ? "Convex bridge env absent (NEXT_PUBLIC_CONVEX_URL / SERVER_BRIDGE_SECRET)" : false;

// Throwaway user ids, far from real accounts.
const U1 = 900001, U2 = 900002;
const c = () => new ConvexHttpClient(URL!);

async function cleanup() {
  if (skip) return;
  const client = c();
  // remove any throwaway supplements + household links
  for (const uid of [U1, U2]) {
    const { rows } = await client.query(api.supplements.list, { secret: SECRET!, authUserId: uid });
    for (const r of rows as Array<{ id: number }>) await client.mutation(api.supplements.remove, { secret: SECRET!, authUserId: uid, id: r.id });
  }
  const { pendingOutgoing, canView } = await client.query(api.household.list, { secret: SECRET!, userId: U1 });
  for (const l of [...pendingOutgoing, ...canView] as Array<{ id: number }>) await client.mutation(api.household.remove, { secret: SECRET!, userId: U1, id: l.id });
}

beforeEach(cleanup);
afterEach(cleanup);

test("supplements: a user only sees their own; viewing another without a link fails closed", { skip }, async () => {
  const client = c();
  await client.mutation(api.supplements.upsert, { secret: SECRET!, authUserId: U1, name: "TestVitD" });
  const u1 = await client.query(api.supplements.list, { secret: SECRET!, authUserId: U1 });
  const u2 = await client.query(api.supplements.list, { secret: SECRET!, authUserId: U2 });
  assert.equal(u1.rows.length, 1, "U1 sees their own supplement");
  assert.equal(u2.rows.length, 0, "U2 does NOT see U1's supplement (tenant isolation)");
  // U1 tries to view U2 with no consent link -> resolveReadUser falls back to self.
  const viewNoLink = await client.query(api.supplements.list, { secret: SECRET!, authUserId: U1, viewUserId: U2 });
  assert.equal(viewNoLink.rows.length, 1, "no link -> read falls back to self (fail-closed), sees own 1 not U2's 0");
});

test("household consent: pending grants nothing, active switches scope, revoke removes access", { skip }, async () => {
  const client = c();
  // seed: U1 has 1 supplement, U2 has 0 (from prior test's cleanup U2 is empty; add nothing)
  await client.mutation(api.supplements.upsert, { secret: SECRET!, authUserId: U1, name: "TestVitD" });

  const req = await client.mutation(api.household.request, { secret: SECRET!, viewerId: U1, subjectId: U2, label: null, relationship: null });
  assert.ok(req.ok, "request creates a pending link");

  // Pending: hasActiveLink false, and viewing U2 still returns U1's own data (fail-closed).
  assert.equal((await client.query(api.household.hasActiveLink, { secret: SECRET!, viewerId: U1, subjectId: U2 })).active, false);
  const pendingView = await client.query(api.supplements.list, { secret: SECRET!, authUserId: U1, viewUserId: U2 });
  assert.equal(pendingView.rows.length, 1, "pending link grants NO access -> still sees own data");

  // Approve (consent gate: only the subject U2 can).
  await client.mutation(api.household.respond, { secret: SECRET!, subjectId: U2, id: req.id!, approve: true });
  assert.equal((await client.query(api.household.hasActiveLink, { secret: SECRET!, viewerId: U1, subjectId: U2 })).active, true);
  const activeView = await client.query(api.supplements.list, { secret: SECRET!, authUserId: U1, viewUserId: U2 });
  assert.equal(activeView.rows.length, 0, "active link -> scope switches to U2 (who has 0 supplements, not U1's 1)");

  // Revoke -> access gone.
  await client.mutation(api.household.remove, { secret: SECRET!, userId: U1, id: req.id! });
  assert.equal((await client.query(api.household.hasActiveLink, { secret: SECRET!, viewerId: U1, subjectId: U2 })).active, false);
});

test("writes always scope to self even while viewing an active-linked member", { skip }, async () => {
  const client = c();
  // active link U1 -> U2
  const req = await client.mutation(api.household.request, { secret: SECRET!, viewerId: U1, subjectId: U2, label: null, relationship: null });
  await client.mutation(api.household.respond, { secret: SECRET!, subjectId: U2, id: req.id!, approve: true });
  // A write mutation only takes authUserId (no viewUserId) — so it can only ever write to self.
  await client.mutation(api.supplements.upsert, { secret: SECRET!, authUserId: U1, name: "WrittenBySelf" });
  const u2 = await client.query(api.supplements.list, { secret: SECRET!, authUserId: U2 });
  assert.equal(u2.rows.length, 0, "U1's write did NOT land in U2's account (writes are self-only by construction)");
  await client.mutation(api.household.remove, { secret: SECRET!, userId: U1, id: req.id! });
});
