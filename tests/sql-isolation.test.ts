/**
 * Static SQL-isolation guard.
 *
 * The schema doesn't model user_id, so every per-user query is hand-written raw
 * SQL with a manual `WHERE user_id = ?`. That's ~290 chances to forget the
 * filter — and forgetting it is exactly how each multi-tenant leak happened.
 *
 * This test scans every `.prepare(...)` SQL in app/ and lib/ and fails if a
 * statement touches a user-scoped table without referencing `user_id`. It is a
 * heuristic backstop, not a parser — known-safe exceptions live in ALLOWLIST.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Tables that hold per-user data. A query reading/writing these MUST scope by user_id.
const USER_TABLES = [
  "biomarker", "document", "dna_variant", "dna_insight", "note", "rag_chunk",
  "rag_keyword", "report", "profile", "symptom_log", "habit_log", "supplement",
  "supplement_log", "blood_report", "action_plan", "reminder", "chat_memory",
  "chat_session", "chat_message", "wearable_metric", "weekly_checkin",
  "share_link", "push_subscription", "card_feedback", "nutrition_pref", "ingest_log",
];

// Legitimate exceptions: substring of the SQL (lowercased) that may appear without user_id.
// Keep this list short and justified — each entry is a query we've reviewed.
const ALLOWLIST: string[] = [
  // joins that scope via the joined table's user_id (the alias differs)
  "join (select slug, max(date) as md from biomarker where user_id",

  // Chat: session ownership is verified (SELECT user_id FROM chat_session WHERE
  // id=? → 404 on mismatch) BEFORE any session_id-scoped operation runs.
  "from chat_message where session_id = ? order by created_at asc",
  "from chat_message where session_id = ? order by id asc limit 40",
  "from chat_message where session_id = ? order by id desc limit 12",
  "select count(*) c from chat_message where session_id = ?",
  "delete from chat_message where session_id = ?",
  "delete from chat_session where id = ?",
  "update chat_session set title = ? where id = ?",
  "update chat_session set updated_at = ? where id = ?",

  // Operate on a row the caller just created/owns in the same request:
  "select id, title, description, due_at, category, done, created_at from reminder where id = ?", // SELECT-after-INSERT of own reminder
  "select meta from report where id = ?",                                  // own welcome report (reportId from own INSERT)
  "update report set meta = ? where id = ?",
  "update report set title = ?, body = ?, meta = ? where id = ?",
  "update document set category =",                                        // ingest: id from a user-scoped SELECT
  "delete from rag_chunk where doc_id = ?",                                // ingest: doc just upserted for this user

  // Token-gated: the share row was fetched by its secret token first.
  "update share_link set views = views + 1, last_viewed_at = ? where id = ?",

  // Push cron: ids come from a per-user subscription row already in hand.
  "update push_subscription set last_used_at = ? where id = ?",
  "delete from push_subscription where id = ?",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Extract the SQL text of each `.prepare(` call. Handles backtick/'/" literals,
 * including multi-line template literals (interpolations kept as raw text). */
function extractPreparedSql(src: string): string[] {
  const sqls: string[] = [];
  let i = 0;
  while ((i = src.indexOf(".prepare(", i)) !== -1) {
    let j = i + ".prepare(".length;
    while (j < src.length && /\s/.test(src[j])) j++;
    const quote = src[j];
    if (quote === "`" || quote === "'" || quote === '"') {
      j++;
      let buf = "";
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\") { buf += src[j + 1]; j += 2; continue; }
        buf += src[j]; j++;
      }
      sqls.push(buf);
    }
    i = j + 1;
  }
  return sqls;
}

const TABLE_RE = (t: string) => new RegExp(`\\b(from|join|into|update|delete\\s+from)\\s+\`?${t}\\b`, "i");
const DDL_RE = /\b(create\s+table|alter\s+table|create\s+index|drop\s+table|drop\s+index|pragma|begin|commit|rollback|create\s+virtual)\b/i;

test("no per-user SQL query omits user_id (multi-tenant isolation guard)", () => {
  const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "lib"))]
    .filter((f) => !f.endsWith(path.join("lib", "db", "migrate.ts"))); // schema management

  const violations: string[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const raw of extractPreparedSql(src)) {
      const sql = raw.toLowerCase().replace(/\s+/g, " ").trim();
      if (!sql || DDL_RE.test(sql)) continue;
      if (sql.includes("user_id")) continue;
      if (ALLOWLIST.some((a) => sql.includes(a))) continue;
      const hit = USER_TABLES.find((t) => TABLE_RE(t).test(sql));
      if (hit) {
        violations.push(`${path.relative(ROOT, file)}\n    table=${hit} | ${raw.trim().slice(0, 120)}`);
      }
    }
  }

  assert.equal(
    violations.length, 0,
    `Found ${violations.length} per-user SQL statement(s) without user_id scoping:\n\n${violations.join("\n\n")}\n\n` +
    `Add "WHERE user_id = ?" (or an explicit ALLOWLIST entry with justification).`,
  );
});
