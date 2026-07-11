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
import crypto from "node:crypto";

// Point the app at a throwaway DB *before* any app module loads it.
const TMP = path.join(os.tmpdir(), `vitals-isolation-${process.pid}.db`);
process.env.VITALS_DB_PATH = TMP;
for (const ext of ["", "-wal", "-shm"]) { try { fs.unlinkSync(TMP + ext); } catch {} }

// Self-contained field-encryption key so the suite passes on any machine, even
// one without a real data/auth.json (decryptProfile would otherwise throw on a
// missing creds file). Must be set before any app module reads getFieldKey().
const TMP_CREDS = path.join(os.tmpdir(), `vitals-isolation-creds-${process.pid}.json`);
fs.writeFileSync(TMP_CREDS, JSON.stringify({ fieldEncryptionKey: crypto.randomBytes(32).toString("base64") }));
process.env.VITALS_CREDS_PATH = TMP_CREDS;

// Dynamic imports so the env var above is set when lib/db initialises.
type Sqlite = { prepare: (q: string) => { run: (...a: unknown[]) => unknown; get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] } };
let sqlite: Sqlite;
let searchRag: (q: string, limit: number, userId: number) => Promise<Array<{ docId: number; path: string }>>;
let computeLongevityScore: (userId: number) => { total: number; details: { biomarkersTotal: number } };
let ingestDnaForUser: (userId: number, baseDir: string) => Promise<{ variants: number; insights: number }>;
let rederiveDnaInsights: (userId: number) => { insights: number };
let computeEnvironment: (userId: number) => { location: { label: string; lat: number } | null; sun: { lowUvMonths: number } | null };
let hasActiveLink: (viewerId: number, subjectId: number) => boolean;
let listHousehold: (userId: number) => { canView: Array<{ otherId: number }>; pendingOutgoing: unknown[]; pendingIncoming: unknown[] };

const U1 = 101;
const U2 = 202;

before(async () => {
  const { db } = await import("../lib/db/index.ts");
  const { ensureSchema } = await import("../lib/db/migrate.ts");
  ({ searchRag } = await import("../lib/rag/search.ts"));
  ({ computeLongevityScore } = await import("../lib/scoring/longevity.ts"));
  ({ ingestDnaForUser } = await import("../lib/ingest/index.ts"));
  ({ rederiveDnaInsights } = await import("../lib/dna/rederive.ts"));
  ({ computeEnvironment } = await import("../lib/environment.ts"));
  ({ hasActiveLink } = await import("../lib/auth.ts"));
  ({ listHousehold } = await import("../lib/household.ts"));
  ensureSchema();
  sqlite = (db() as unknown as { $client: Sqlite }).$client;
  seed();
});

after(() => {
  for (const ext of ["", "-wal", "-shm"]) { try { fs.unlinkSync(TMP + ext); } catch {} }
  try { fs.unlinkSync(TMP_CREDS); } catch {}
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

// SKIPPED: biomarker/dna_insight/profile reads moved to Convex; isolation is now
// enforced by resolveReadUser in convex/*.ts (writes scope to self). Needs
// convex-test coverage — a required pre-merge gate for the migration.
test("computeLongevityScore uses only the caller's biomarkers", { skip: "migrated to Convex; cover via convex-test before merge" }, () => {
  const s1 = computeLongevityScore(U1);
  const s2 = computeLongevityScore(U2);
  assert.ok(s1.details.biomarkersTotal >= 1, "U1 has evaluable biomarkers");
  assert.equal(s2.details.biomarkersTotal, 0, "U2 has zero biomarkers — must not borrow U1's (the dashboard leak)");
});

// Real 23andMe header sits after ~14 comment lines, then tab-separated SNPs.
// Two catalog rsids so dna_insight gets populated for the importer.
const GENOME_FIXTURE = [
  "# This data file generated by 23andMe at: Wed Jan 01 03:16:03 2026",
  "# This file contains raw genotype data.",
  "# rsid\tchromosome\tposition\tgenotype",
  "rs1042725\t12\t66358347\tCC",
  "rs1051730\t15\t78894339\tAA",
  "rs4477212\t1\t82154\tAG",
].join("\n");

function writeGenome(userId: number): string {
  const baseDir = path.join(os.tmpdir(), `vitals-dna-${process.pid}-${userId}`);
  const dir = path.join(baseDir, "genetique");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `genome_User${userId}_v5_Full.txt`), GENOME_FIXTURE);
  return baseDir;
}

test("ingestDnaForUser isolates raw variants per user (composite PK, no clobber)", { skip: "dna_insight write moved to Convex; dna_variant isolation covered by SQL guard + convex-test before merge" }, async () => {
  // U1's genome lands first; U2 then imports a genome with the SAME rsids but
  // different genotypes. With the old global `rsid PRIMARY KEY`, U2's import
  // would REPLACE U1's rows. Composite PK (rsid, user_id) must keep both.
  sqlite.prepare(`INSERT OR REPLACE INTO dna_variant (rsid, chromosome, position, genotype, user_id) VALUES ('rs1042725','12',66358347,'TT',?)`).run(U1);

  const r2 = await ingestDnaForUser(U2, writeGenome(U2));
  assert.ok(r2.variants >= 3, "U2's genome ingested");
  assert.ok(r2.insights >= 2, "U2 got catalog-derived insights (also proves boolean→0/1 bind)");

  const u1 = sqlite.prepare(`SELECT genotype FROM dna_variant WHERE rsid='rs1042725' AND user_id=?`).get(U1) as { genotype: string } | undefined;
  assert.equal(u1?.genotype, "TT", "U1's variant survived U2's import (no cross-user clobber)");

  const u2 = sqlite.prepare(`SELECT genotype FROM dna_variant WHERE rsid='rs1042725' AND user_id=?`).get(U2) as { genotype: string } | undefined;
  assert.equal(u2?.genotype, "CC", "U2 stored their own genotype under their own row");

  const u1insights = sqlite.prepare(`SELECT COUNT(*) c FROM dna_insight WHERE user_id=?`).get(U1) as { c: number };
  assert.equal(u1insights.c, 0, "U1 got no insights from U2's import");
});

test("rederiveDnaInsights rebuilds insights from stored variants, user-scoped", { skip: "dna_insight write moved to Convex; cover via convex-test before merge" }, () => {
  // Dedicated ids, untouched by other tests. A has a catalog genotype; B has none.
  const A = 303, B = 404;
  sqlite.prepare(`INSERT OR REPLACE INTO dna_variant (rsid, chromosome, position, genotype, user_id) VALUES ('rs28940279','12',1,'CC',?)`).run(A);

  const rA = rederiveDnaInsights(A);
  assert.ok(rA.insights >= 1, "A's insights derived from stored variants (no genome file needed)");

  const aPku = sqlite.prepare(`SELECT has_risk FROM dna_insight WHERE rsid='rs28940279' AND user_id=?`).get(A) as { has_risk: number } | undefined;
  assert.equal(aPku?.has_risk, 1, "CC is flagged per the current catalog (PKU risk = AC/CC)");

  const rB = rederiveDnaInsights(B);
  assert.equal(rB.insights, 0, "B has no stored variants → nothing derived");
  const bCount = sqlite.prepare(`SELECT COUNT(*) c FROM dna_insight WHERE user_id=?`).get(B) as { c: number };
  assert.equal(bCount.c, 0, "re-deriving A never touches another account");
});

test("computeEnvironment derives from the caller's own city only", { skip: "profile/dna/biomarker reads moved to Convex; cover via convex-test before merge" }, () => {
  // U1 lives in a high-latitude city; U2 has no profile → no environment.
  sqlite.prepare(`INSERT INTO profile (data, updated_at, user_id) VALUES (?, 1, ?)`)
    .run(JSON.stringify({ currentLocation: { city: "Lille", countryCode: "FR" } }), U1);

  const e1 = computeEnvironment(U1);
  assert.equal(e1.location?.label, "Lille");
  assert.ok((e1.sun?.lowUvMonths ?? 0) >= 5, "Lille (~51°) has a long low-UV season");

  const e2 = computeEnvironment(U2);
  assert.equal(e2.location, null, "U2 has no profile → no environment (no cross-user read)");
});

test("wearable_metric allows the same (date, source, kind) across users", () => {
  const rows = sqlite.prepare(`SELECT user_id, value FROM wearable_metric WHERE date='2026-01-01' AND source='whoop' AND kind='recovery' ORDER BY user_id`).all() as Array<{ user_id: number; value: number }>;
  assert.equal(rows.length, 2, "both users keep their own same-day metric (no cross-user clobber)");
  assert.deepEqual(rows.map((r) => r.user_id), [U1, U2]);
});

test("household: viewing data requires an ACTIVE (consented) link — pending grants nothing", () => {
  const V = 501, S = 502; // V wants to view S's data
  for (const [id, email] of [[V, "viewer@x.test"], [S, "subject@x.test"]] as const) {
    sqlite.prepare(`INSERT OR IGNORE INTO user (id, email, hash, secret) VALUES (?, ?, 'h', ?)`).run(id, email, "x".repeat(40));
  }
  // V requests to view S — pending, awaiting S's consent.
  sqlite.prepare(`INSERT INTO household_link (viewer_user_id, subject_user_id, status) VALUES (?, ?, 'pending')`).run(V, S);
  assert.equal(hasActiveLink(V, S), false, "a PENDING link must not grant read access (consent gate)");

  // The request shows up in S's consent inbox, and grants V nothing yet.
  assert.equal(listHousehold(S).pendingIncoming.length, 1, "S sees the pending request to approve");
  assert.equal(listHousehold(V).canView.length, 0, "V cannot view anyone until approved");

  // S approves.
  sqlite.prepare(`UPDATE household_link SET status='active' WHERE viewer_user_id=? AND subject_user_id=?`).run(V, S);
  assert.equal(hasActiveLink(V, S), true, "an ACTIVE link grants read access");
  assert.equal(hasActiveLink(S, V), false, "links are directional: consent to be viewed ≠ right to view back");

  const v = listHousehold(V);
  assert.equal(v.canView.length, 1, "V can now view exactly one member");
  assert.equal(v.canView[0].otherId, S, "…and it's S");
  assert.equal(listHousehold(S).pendingIncoming.length, 0, "approved request leaves S's inbox");
});
