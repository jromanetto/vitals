/**
 * Multi-tenant isolation regression tests.
 *
 * Every leak we fixed (dashboard score, RAG chat, reports, ingestion) had the
 * same root cause: a query on a user-data table missing its user_id filter.
 * These tests seed two users and assert that one account's reads never surface
 * the other's data. Run against a throwaway temp DB so prod is untouched.
 *
 * Run: npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Point the app at a throwaway DB *before* any app module loads it.
const TMP = path.join(os.tmpdir(), `vitals-isolation-${process.pid}.db`);
process.env.VITALS_DB_PATH = TMP;
for (const ext of ["", "-wal", "-shm"]) { try { fs.unlinkSync(TMP + ext); } catch {} }

// Dynamic imports so the env var above is set when lib/db initialises.
type Sqlite = { prepare: (q: string) => { run: (...a: unknown[]) => unknown; get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] } };
let sqlite: Sqlite;
let searchRag: (q: string, limit: number, userId: number) => Promise<Array<{ docId: number; path: string }>>;
let computeLongevityScore: (userId: number) => { total: number; details: { biomarkersTotal: number } };

const U1 = 101;
const U2 = 202;

before(async () => {
  const { db } = await import("../lib/db/index.ts");
  const { ensureSchema } = await import("../lib/db/migrate.ts");
  ({ searchRag } = await import("../lib/rag/search.ts"));
  ({ computeLongevityScore } = await import("../lib/scoring/longevity.ts"));
  ensureSchema();
  sqlite = (db() as unknown as { $client: Sqlite }).$client;
  seed();
});

after(() => {
  for (const ext of ["", "-wal", "-shm"]) { try { fs.unlinkSync(TMP + ext); } catch {} }
});

function seedDocWithKeyword(userId: number, docPath: string, term: string) {
  const dr = sqlite.prepare(`INSERT INTO document (path, category, title, text_content, hash, user_id) VALUES (?, 'divers', ?, ?, ?, ?)`)
    .run(docPath, term, `${term} content`, `hash-${docPath}`, userId) as { lastInsertRowid: number | bigint };
  const docId = Number(dr.lastInsertRowid);
  const cr = sqlite.prepare(`INSERT INTO rag_chunk (doc_id, chunk_idx, text, user_id) VALUES (?, 0, ?, ?)`)
    .run(docId, `${term} measured`, userId) as { lastInsertRowid: number | bigint };
  const chunkId = Number(cr.lastInsertRowid);
  sqlite.prepare(`INSERT INTO rag_keyword (chunk_id, term, tf, user_id) VALUES (?, ?, 1.0, ?)`).run(chunkId, term, userId);
  return docId;
}

function seed() {
  sqlite.prepare(`INSERT INTO user (id, email, hash, secret, role) VALUES (?, 'u1@test', 'x', 'x', 'beta')`).run(U1);
  sqlite.prepare(`INSERT INTO user (id, email, hash, secret, role) VALUES (?, 'u2@test', 'x', 'x', 'beta')`).run(U2);

  // RAG corpus: distinct terms per user.
  seedDocWithKeyword(U1, "/u1/cholesterol.pdf", "cholesterol");
  seedDocWithKeyword(U2, "/u2/glucose.pdf", "glucose");

  // Biomarkers: only U1 has any (lets us assert U2's score uses none of U1's).
  const now = Date.now();
  sqlite.prepare(`INSERT INTO biomarker (name, slug, category, value, unit, ref_low, ref_high, date, source, user_id) VALUES ('LDL','ldl','lipids',2.0,'g/L',0,3,?, '/u1/cholesterol.pdf', ?)`).run(now, U1);

  // Wearables: same (date, source, kind) for BOTH users must coexist (per-user UNIQUE).
  sqlite.prepare(`INSERT INTO wearable_metric (date, source, kind, value, unit, user_id) VALUES ('2026-01-01','whoop','recovery',70,'%',?)`).run(U1);
  sqlite.prepare(`INSERT INTO wearable_metric (date, source, kind, value, unit, user_id) VALUES ('2026-01-01','whoop','recovery',55,'%',?)`).run(U2);
}

test("searchRag only returns the caller's own documents", async () => {
  const u1hits = await searchRag("cholesterol", 10, U1);
  assert.equal(u1hits.length, 1, "U1 finds their own cholesterol doc");
  assert.equal(u1hits[0].path, "/u1/cholesterol.pdf");

  const u2hits = await searchRag("cholesterol", 10, U2);
  assert.equal(u2hits.length, 0, "U2 must NOT see U1's cholesterol doc (the chat RAG leak)");

  const crossUser = await searchRag("glucose", 10, U1);
  assert.equal(crossUser.length, 0, "U1 must NOT see U2's glucose doc");
});

test("computeLongevityScore uses only the caller's biomarkers", () => {
  const s1 = computeLongevityScore(U1);
  const s2 = computeLongevityScore(U2);
  assert.ok(s1.details.biomarkersTotal >= 1, "U1 has evaluable biomarkers");
  assert.equal(s2.details.biomarkersTotal, 0, "U2 has zero biomarkers — must not borrow U1's (the dashboard leak)");
});

test("wearable_metric allows the same (date, source, kind) across users", () => {
  const rows = sqlite.prepare(`SELECT user_id, value FROM wearable_metric WHERE date='2026-01-01' AND source='whoop' AND kind='recovery' ORDER BY user_id`).all() as Array<{ user_id: number; value: number }>;
  assert.equal(rows.length, 2, "both users keep their own same-day metric (no cross-user clobber)");
  assert.deepEqual(rows.map((r) => r.user_id), [U1, U2]);
});
