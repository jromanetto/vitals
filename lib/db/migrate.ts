import "server-only";
import { db } from "./index";
import { sql } from "drizzle-orm";

export function ensureSchema() {
  const d = db();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS biomarker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category TEXT,
      value REAL NOT NULL,
      unit TEXT,
      ref_low REAL,
      ref_high REAL,
      date INTEGER NOT NULL,
      source TEXT,
      raw_text TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS biomarker_slug_idx ON biomarker(slug)`,
    `CREATE INDEX IF NOT EXISTS biomarker_date_idx ON biomarker(date)`,
    `CREATE TABLE IF NOT EXISTS dna_variant (
      rsid TEXT PRIMARY KEY,
      chromosome TEXT NOT NULL,
      position INTEGER NOT NULL,
      genotype TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS dna_chr_idx ON dna_variant(chromosome)`,
    `CREATE TABLE IF NOT EXISTS dna_insight (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rsid TEXT NOT NULL,
      category TEXT NOT NULL,
      trait TEXT NOT NULL,
      effect TEXT,
      magnitude REAL,
      risk_allele TEXT,
      user_genotype TEXT,
      has_risk INTEGER,
      summary TEXT,
      source TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS dna_insight_cat_idx ON dna_insight(category)`,
    `CREATE INDEX IF NOT EXISTS dna_insight_rsid_idx ON dna_insight(rsid)`,
    `CREATE TABLE IF NOT EXISTS document (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      title TEXT,
      date INTEGER,
      pages INTEGER,
      text_content TEXT,
      hash TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS rag_chunk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
      chunk_idx INTEGER NOT NULL,
      text TEXT NOT NULL,
      tokens INTEGER,
      embedding TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS rag_doc_idx ON rag_chunk(doc_id)`,
    `CREATE TABLE IF NOT EXISTS rag_keyword (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id INTEGER NOT NULL REFERENCES rag_chunk(id) ON DELETE CASCADE,
      term TEXT NOT NULL,
      tf REAL NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS rag_term_idx ON rag_keyword(term)`,
    `CREATE TABLE IF NOT EXISTS note (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS report (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      meta TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS ingest_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
  ];
  for (const s of stmts) d.run(sql.raw(s));
}
