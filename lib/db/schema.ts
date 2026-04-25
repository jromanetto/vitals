import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  data: text("data", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const biomarker = sqliteTable("biomarker", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  category: text("category"),
  value: real("value").notNull(),
  unit: text("unit"),
  refLow: real("ref_low"),
  refHigh: real("ref_high"),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  source: text("source"),
  rawText: text("raw_text"),
}, (t) => ({
  slugIdx: index("biomarker_slug_idx").on(t.slug),
  dateIdx: index("biomarker_date_idx").on(t.date),
}));

export const dnaVariant = sqliteTable("dna_variant", {
  rsid: text("rsid").primaryKey(),
  chromosome: text("chromosome").notNull(),
  position: integer("position").notNull(),
  genotype: text("genotype").notNull(),
}, (t) => ({
  chrIdx: index("dna_chr_idx").on(t.chromosome),
}));

export const dnaInsight = sqliteTable("dna_insight", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rsid: text("rsid").notNull(),
  category: text("category").notNull(),
  trait: text("trait").notNull(),
  effect: text("effect"),
  magnitude: real("magnitude"),
  riskAllele: text("risk_allele"),
  userGenotype: text("user_genotype"),
  hasRisk: integer("has_risk", { mode: "boolean" }),
  summary: text("summary"),
  source: text("source"),
}, (t) => ({
  catIdx: index("dna_insight_cat_idx").on(t.category),
  rsidIdx: index("dna_insight_rsid_idx").on(t.rsid),
}));

export const document = sqliteTable("document", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull().unique(),
  category: text("category").notNull(),
  title: text("title"),
  date: integer("date", { mode: "timestamp_ms" }),
  pages: integer("pages"),
  textContent: text("text_content"),
  hash: text("hash"),
});

export const ragChunk = sqliteTable("rag_chunk", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  docId: integer("doc_id").notNull().references(() => document.id, { onDelete: "cascade" }),
  chunkIdx: integer("chunk_idx").notNull(),
  text: text("text").notNull(),
  tokens: integer("tokens"),
  embedding: text("embedding"),
}, (t) => ({
  docIdx: index("rag_doc_idx").on(t.docId),
}));

export const ragKeyword = sqliteTable("rag_keyword", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chunkId: integer("chunk_id").notNull().references(() => ragChunk.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
  tf: real("tf").notNull(),
}, (t) => ({
  termIdx: index("rag_term_idx").on(t.term),
}));

export const note = sqliteTable("note", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const report = sqliteTable("report", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  meta: text("meta", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const ingestLog = sqliteTable("ingest_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});
