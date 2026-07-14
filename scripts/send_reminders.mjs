#!/usr/bin/env node
/**
 * Reminder push cron — run hourly:
 *   0 * * * * cd /home/script/vitals && node scripts/send_reminders.mjs >> logs/reminders-cron.log 2>&1
 *
 * Reads due reminders (next 24h, not done, not notified) + push subscriptions
 * from CONVEX (not SQLite), sends web-push, marks notified, prunes dead subs.
 *
 * Prod env: needs NEXT_PUBLIC_CONVEX_URL + SERVER_BRIDGE_SECRET. These are read
 * from process.env, else from data/auth.json (fields `convexUrl` +
 * `serverBridgeSecret`), else from .env.local (dev).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import webpush from "web-push";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AUTH_PATH = process.env.VITALS_CREDS_PATH || path.join(ROOT, "data", "auth.json");

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function loadAuth() {
  const raw = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  if (!raw.vapidPublicKey || !raw.vapidPrivateKey) {
    throw new Error("VAPID keys missing in data/auth.json");
  }
  return raw;
}

async function main() {
  loadEnvLocal();
  const auth = loadAuth();
  webpush.setVapidDetails(
    auth.vapidSubject || "mailto:contact@vitals.blueproject.org",
    auth.vapidPublicKey,
    auth.vapidPrivateKey
  );

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || auth.convexUrl;
  const secret = process.env.SERVER_BRIDGE_SECRET || auth.serverBridgeSecret;
  if (!convexUrl || !secret) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL / SERVER_BRIDGE_SECRET missing (env or data/auth.json)");
  }
  const convex = new ConvexHttpClient(convexUrl);

  const now = Date.now();
  const horizon = now + 24 * 60 * 60 * 1000;

  const { rows } = await convex.query(api.reminders.due, { secret, horizon });
  if (rows.length === 0) {
    log("no due reminders within 24h");
    return;
  }
  log(`found ${rows.length} reminder(s) to notify`);

  for (const r of rows) {
    const { rows: subs } = await convex.query(api.push.subsForSend, { secret, userId: r.userId });

    if (subs.length === 0) {
      log(`reminder ${r.id} (user ${r.userId}): no subscriptions, marking notified`);
      await convex.mutation(api.reminders.markNotified, { secret, id: r.id, at: Date.now() });
      continue;
    }

    const dueLabel = new Date(r.dueAt).toLocaleString("fr-FR", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
    const payload = JSON.stringify({
      title: `Rappel — ${r.title}`,
      body: r.description ? `${r.description}\n${dueLabel}` : `Échéance : ${dueLabel}`,
      url: "/reminders",
      tag: `reminder-${r.id}`,
    });

    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        await convex.mutation(api.push.touchLastUsed, { secret, id: s.id });
        sent += 1;
      } catch (e) {
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await convex.mutation(api.push.deleteById, { secret, id: s.id });
          log(`pruned expired subscription ${s.id}`);
        } else {
          log(`push error sub=${s.id} reminder=${r.id}:`, e?.message ?? e);
        }
      }
    }

    await convex.mutation(api.reminders.markNotified, { secret, id: r.id, at: Date.now() });
    log(`reminder ${r.id} (${r.title}) notified to ${sent}/${subs.length} device(s)`);
  }
}

main().catch((e) => {
  console.error("send_reminders failed:", e);
  process.exit(1);
});
