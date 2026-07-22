/**
 * Weekly digest cron — POST/GET /api/cron/weekly-digest
 *
 * Auth: the external scheduler (VPS cron) must supply the shared secret either as
 *   - header  `x-cron-secret: <CRON_SECRET>`     (preferred)
 *   - query   `?secret=<CRON_SECRET>`            (fallback for curl / wget)
 *
 * Behavior:
 *   1. Ensure schema.
 *   2. List every user that has had any activity (biomarker / symptom_log /
 *      supplement_log insert) in the last 30 days.
 *   3. For each, compute weekly deltas. If the deltas are non-empty, send the
 *      digest email via Resend (`sendEmail` + `weeklyDigestTemplate`).
 *   4. Return JSON summary { ok, processed, sent, skipped, errors }.
 *
 * Failures on individual users are caught and reported in `errors[]` — one bad
 * user must not break the whole batch.
 */
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  computeWeeklyDeltas,
  hasMeaningfulDeltas,
  userHasRecentActivity,
  weeklyDigestTemplate,
} from "@/lib/email-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = { id: number; email: string };

type PerUserResult =
  | { userId: number; email: string; status: "sent"; emailId?: string }
  | { userId: number; email: string; status: "skipped"; reason: string }
  | { userId: number; email: string; status: "error"; error: string };

function checkSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured = locked closed. Fail safe.
    return false;
  }
  const hdr = req.headers.get("x-cron-secret");
  if (hdr && hdr === expected) return true;
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("secret");
    if (q && q === expected) return true;
  } catch {
    /* ignore malformed URL */
  }
  return false;
}

async function runDigest(req: Request): Promise<Response> {
  if (!checkSecret(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Pull recipients from Convex, the source of truth for accounts.
  let users: UserRow[] = [];
  try {
    users = (await convexServer().query(api.users.listAll, { secret: bridgeSecret() })).rows;
  } catch (e) {
    console.error("[weekly-digest] user list", e);
    users = [];
  }

  const results: PerUserResult[] = [];
  let sent = 0;
  let skipped = 0;
  let errored = 0;

  const emailReady = isEmailConfigured();

  for (const u of users) {
    try {
      if (!(await userHasRecentActivity(u.id))) {
        results.push({ userId: u.id, email: u.email, status: "skipped", reason: "no recent activity" });
        skipped++;
        continue;
      }
      const deltas = await computeWeeklyDeltas(u.id);
      if (!hasMeaningfulDeltas(deltas)) {
        results.push({ userId: u.id, email: u.email, status: "skipped", reason: "no meaningful deltas" });
        skipped++;
        continue;
      }
      const tpl = weeklyDigestTemplate(deltas);
      if (!emailReady) {
        results.push({ userId: u.id, email: u.email, status: "skipped", reason: "email not configured" });
        skipped++;
        continue;
      }
      const res = await sendEmail({ to: u.email, ...tpl });
      if (res.ok) {
        results.push({ userId: u.id, email: u.email, status: "sent", emailId: res.id });
        sent++;
      } else {
        results.push({ userId: u.id, email: u.email, status: "error", error: res.error ?? "send failed" });
        errored++;
      }
    } catch (e) {
      results.push({
        userId: u.id,
        email: u.email,
        status: "error",
        error: (e as Error)?.message ?? "unknown error",
      });
      errored++;
    }
  }

  return Response.json({
    ok: true,
    processed: users.length,
    sent,
    skipped,
    errors: errored,
    results,
    ts: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  return runDigest(req);
}

export async function GET(req: Request) {
  return runDigest(req);
}
