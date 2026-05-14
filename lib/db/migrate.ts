import { db } from "./index";
import { sql } from "drizzle-orm";

export function ensureSchema() {
  const d = db();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`,
    `CREATE TABLE IF NOT EXISTS biomarker (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL, category TEXT, value REAL NOT NULL, unit TEXT, ref_low REAL, ref_high REAL, date INTEGER NOT NULL, source TEXT, raw_text TEXT)`,
    `CREATE INDEX IF NOT EXISTS biomarker_slug_idx ON biomarker(slug)`,
    `CREATE INDEX IF NOT EXISTS biomarker_date_idx ON biomarker(date)`,
    `CREATE TABLE IF NOT EXISTS dna_variant (rsid TEXT PRIMARY KEY, chromosome TEXT NOT NULL, position INTEGER NOT NULL, genotype TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS dna_chr_idx ON dna_variant(chromosome)`,
    `CREATE TABLE IF NOT EXISTS dna_insight (id INTEGER PRIMARY KEY AUTOINCREMENT, rsid TEXT NOT NULL, category TEXT NOT NULL, trait TEXT NOT NULL, effect TEXT, magnitude REAL, risk_allele TEXT, user_genotype TEXT, has_risk INTEGER, summary TEXT, source TEXT)`,
    `CREATE INDEX IF NOT EXISTS dna_insight_cat_idx ON dna_insight(category)`,
    `CREATE INDEX IF NOT EXISTS dna_insight_rsid_idx ON dna_insight(rsid)`,
    `CREATE TABLE IF NOT EXISTS document (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, category TEXT NOT NULL, title TEXT, date INTEGER, pages INTEGER, text_content TEXT, hash TEXT)`,
    `CREATE TABLE IF NOT EXISTS rag_chunk (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_id INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE, chunk_idx INTEGER NOT NULL, text TEXT NOT NULL, tokens INTEGER, embedding TEXT)`,
    `CREATE INDEX IF NOT EXISTS rag_doc_idx ON rag_chunk(doc_id)`,
    `CREATE TABLE IF NOT EXISTS rag_keyword (id INTEGER PRIMARY KEY AUTOINCREMENT, chunk_id INTEGER NOT NULL REFERENCES rag_chunk(id) ON DELETE CASCADE, term TEXT NOT NULL, tf REAL NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS rag_term_idx ON rag_keyword(term)`,
    `CREATE TABLE IF NOT EXISTS note (id INTEGER PRIMARY KEY AUTOINCREMENT, target_type TEXT NOT NULL, target_id TEXT NOT NULL, body TEXT NOT NULL, tags TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`,
    `CREATE INDEX IF NOT EXISTS note_target_idx ON note(target_type, target_id)`,
    `CREATE INDEX IF NOT EXISTS note_created_idx ON note(created_at)`,
    `CREATE TABLE IF NOT EXISTS report (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, meta TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`,
    `CREATE TABLE IF NOT EXISTS ingest_log (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, status TEXT NOT NULL, detail TEXT, duration_ms INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`,
    `CREATE TABLE IF NOT EXISTS chat_session (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS chat_message (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, sources TEXT, created_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS chat_msg_session_idx ON chat_message(session_id)`,
    `CREATE TABLE IF NOT EXISTS supplement (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, dose TEXT, unit TEXT, timing TEXT, frequency TEXT, started_at INTEGER, ended_at INTEGER, notes TEXT, target_biomarker TEXT, target_snp TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`,
    `CREATE INDEX IF NOT EXISTS supplement_active_idx ON supplement(ended_at)`,
    `CREATE TABLE IF NOT EXISTS supplement_log (id INTEGER PRIMARY KEY AUTOINCREMENT, supplement_id INTEGER NOT NULL REFERENCES supplement(id) ON DELETE CASCADE, date TEXT NOT NULL, taken INTEGER NOT NULL DEFAULT 1)`,
    `CREATE INDEX IF NOT EXISTS supplement_log_date_idx ON supplement_log(date)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS supplement_log_unique ON supplement_log(supplement_id, date)`,
    `CREATE TABLE IF NOT EXISTS symptom_log (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, key TEXT NOT NULL, value REAL NOT NULL, notes TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`,
    `CREATE INDEX IF NOT EXISTS symptom_log_date_idx ON symptom_log(date)`,
    `CREATE INDEX IF NOT EXISTS symptom_log_key_idx ON symptom_log(key)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS symptom_log_unique ON symptom_log(date, key)`,
    `CREATE TABLE IF NOT EXISTS habit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, key TEXT NOT NULL, value REAL NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`,
    `CREATE INDEX IF NOT EXISTS habit_log_date_idx ON habit_log(date)`,
    `CREATE INDEX IF NOT EXISTS habit_log_key_idx ON habit_log(key)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS habit_log_unique ON habit_log(date, key)`,
    `CREATE TABLE IF NOT EXISTS wearable_metric (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, unit TEXT, UNIQUE(date, source, kind))`,
    `CREATE INDEX IF NOT EXISTS wearable_date_idx ON wearable_metric(date)`,
    `CREATE INDEX IF NOT EXISTS wearable_kind_idx ON wearable_metric(kind)`,
    // Sprint 28: cross-session chat memory
    `CREATE TABLE IF NOT EXISTS chat_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      source_session_id INTEGER,
      confidence REAL DEFAULT 0.8,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE INDEX IF NOT EXISTS chat_memory_kind_idx ON chat_memory(kind)`,
    `CREATE INDEX IF NOT EXISTS chat_memory_active_idx ON chat_memory(active)`,
    // Sprint 29: reminders system
    `CREATE TABLE IF NOT EXISTS reminder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_at INTEGER NOT NULL,
      category TEXT,
      done INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE INDEX IF NOT EXISTS reminder_due_idx ON reminder(due_at)`,
    `CREATE INDEX IF NOT EXISTS reminder_done_idx ON reminder(done)`,
    // Sprint 30: share links (read-only doctor share)
    `CREATE TABLE IF NOT EXISTS share_link (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      scope TEXT NOT NULL DEFAULT 'praticien',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      expires_at INTEGER NOT NULL,
      views INTEGER DEFAULT 0,
      last_viewed_at INTEGER,
      revoked INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS share_link_token_idx ON share_link(token)`,
    `CREATE INDEX IF NOT EXISTS share_link_user_idx ON share_link(user_id)`,
    // Sprint 31: web push notifications
    `CREATE TABLE IF NOT EXISTS push_subscription (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_used_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS push_sub_user_idx ON push_subscription(user_id)`,
    // Sprint 32: nutrition preferences
    `CREATE TABLE IF NOT EXISTS nutrition_pref (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diet_type TEXT NOT NULL DEFAULT 'omnivore',
      allergies TEXT NOT NULL DEFAULT '[]',
      aversions TEXT NOT NULL DEFAULT '',
      budget TEXT NOT NULL DEFAULT 'medium',
      cuisines TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    // Welcome Report feedback (thumbs up/down + optional comment per card)
    `CREATE TABLE IF NOT EXISTS card_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      report_id INTEGER NOT NULL,
      card_index INTEGER NOT NULL,
      card_title TEXT NOT NULL,
      rating TEXT NOT NULL CHECK (rating IN ('up','down')),
      comment TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE INDEX IF NOT EXISTS card_feedback_user_idx ON card_feedback(user_id)`,
    `CREATE INDEX IF NOT EXISTS card_feedback_report_idx ON card_feedback(report_id)`,
    `CREATE INDEX IF NOT EXISTS card_feedback_created_idx ON card_feedback(created_at)`,
  ];
  for (const s of stmts) d.run(sql.raw(s));
  for (const c of ["url", "brand", "image_url", "ingredients", "serving_size", "suggested_use", "price", "duration"]) {
    try { d.run(sql.raw(`ALTER TABLE supplement ADD COLUMN ${c} TEXT`)); } catch {}
  }
  try { d.run(sql.raw(`ALTER TABLE dna_insight ADD COLUMN is_protective INTEGER DEFAULT 0`)); } catch {}

  // Add tags column to existing note table if it doesn't exist
  try {
    d.run(sql.raw(`ALTER TABLE note ADD COLUMN tags TEXT`));
  } catch {}
  try {
    d.run(sql.raw(`ALTER TABLE note ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`));
  } catch {}
  // Sprint 31: notified_at on reminder for push cron deduplication
  try {
    d.run(sql.raw(`ALTER TABLE reminder ADD COLUMN notified_at INTEGER`));
  } catch {}
  // Sprint 32: per-user scoping for nutrition_pref so demo and owner don't
  // share the same preference row. ALTER is idempotent via try/catch.
  try {
    d.run(sql.raw(`ALTER TABLE nutrition_pref ADD COLUMN user_id INTEGER DEFAULT 1`));
  } catch {}
  try {
    d.run(sql.raw(`CREATE INDEX IF NOT EXISTS nutrition_pref_user_idx ON nutrition_pref(user_id)`));
  } catch {}
}
