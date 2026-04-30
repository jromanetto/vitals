#!/usr/bin/env node
/**
 * Reminder push cron — run hourly:
 *   0 * * * * cd /home/script/vitals && node scripts/send_reminders.mjs >> logs/reminders-cron.log 2>&1
 *
 * Walks the `reminder` table for rows due_at within the next 24h that are not done
 * and not yet notified. Sends a web-push to every push_subscription of the owning user,
 * then marks notified_at to dedupe.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import Database from "better-sqlite3";
import webpush from "web-push";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = process.env.VITALS_DB_PATH || path.join(ROOT, "data", "vitals.db");
const AUTH_PATH = process.env.VITALS_CREDS_PATH || path.join(ROOT, "data", "auth.json");

function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}

function loadAuth() {
  const raw = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  if (!raw.vapidPublicKey || !raw.vapidPrivateKey) {
    throw new Error("VAPID keys missing in data/auth.json");
  }
  return raw;
}

async function main() {
  const auth = loadAuth();
  webpush.setVapidDetails(
    auth.vapidSubject || "mailto:contact@vitals.blueproject.org",
    auth.vapidPublicKey,
    auth.vapidPrivateKey
  );

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  const now = Date.now();
  const horizon = now + 24 * 60 * 60 * 1000;

  const rows = sqlite
    .prepare(
      `SELECT id, user_id, title, description, due_at
       FROM reminder
       WHERE done = 0
         AND notified_at IS NULL
         AND due_at <= ?
       ORDER BY due_at ASC`
    )
    .all(horizon);

  if (rows.length === 0) {
    log("no due reminders within 24h");
    sqlite.close();
    return;
  }

  log(`found ${rows.length} reminder(s) to notify`);

  for (const r of rows) {
    const subs = sqlite
      .prepare(`SELECT id, endpoint, p256dh, auth FROM push_subscription WHERE user_id = ?`)
      .all(r.user_id);

    if (subs.length === 0) {
      log(`reminder ${r.id} (user ${r.user_id}): no subscriptions, marking notified`);
      sqlite.prepare(`UPDATE reminder SET notified_at = ? WHERE id = ?`).run(now, r.id);
      continue;
    }

    const dueDate = new Date(r.due_at);
    const dueLabel = dueDate.toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
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
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sqlite
          .prepare(`UPDATE push_subscription SET last_used_at = ? WHERE id = ?`)
          .run(Date.now(), s.id);
        sent += 1;
      } catch (e) {
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          sqlite.prepare(`DELETE FROM push_subscription WHERE id = ?`).run(s.id);
          log(`pruned expired subscription ${s.id}`);
        } else {
          log(`push error sub=${s.id} reminder=${r.id}:`, e?.message ?? e);
        }
      }
    }

    sqlite.prepare(`UPDATE reminder SET notified_at = ? WHERE id = ?`).run(Date.now(), r.id);
    log(`reminder ${r.id} (${r.title}) notified to ${sent}/${subs.length} device(s)`);
  }

  sqlite.close();
}

main().catch((e) => {
  console.error("send_reminders failed:", e);
  process.exit(1);
});
