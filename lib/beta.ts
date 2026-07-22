/**
 * Beta capacity gate.
 *
 * Signup is open (no invite needed) while the `user` table has fewer rows than
 * `betaUserCap` (set in data/auth.json). Once the cap is hit, new signups fall
 * back to the waitlist. Setting `betaUserCap = currentUsers + N` opens exactly
 * the next N spots. `VITALS_BETA_OPEN=true` forces it fully open regardless.
 */
import fs from "node:fs";
import path from "node:path";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

function readAuth(): { betaUserCap?: number } {
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

export async function betaStatus(): Promise<{ open: boolean; remaining: number; cap: number; count: number; unlimited: boolean }> {
  const envOpen = process.env.VITALS_BETA_OPEN === "true";
  const cap = Number(readAuth().betaUserCap ?? 0) || 0;
  let count = 0;
  try {
    count = (await convexServer().query(api.users.count, { secret: bridgeSecret() })).count;
  } catch {
    // Counting failure must not silently reopen a full beta: a count of 0 would
    // make `count < cap` true and let unlimited signups through. Report the
    // capacity gate as closed and let the invite-code path still work.
    return { open: envOpen, remaining: 0, cap, count: 0, unlimited: envOpen };
  }
  const capOpen = cap > 0 && count < cap;
  const remaining = cap > 0 ? Math.max(0, cap - count) : 0;
  return { open: envOpen || capOpen, remaining, cap, count, unlimited: envOpen };
}
