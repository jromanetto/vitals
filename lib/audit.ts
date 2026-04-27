import { db } from "./db";
import { sql } from "drizzle-orm";

let _ensured = false;

function ensureAuditTable() {
  if (_ensured) return;
  const d = db();
  d.run(sql.raw(`CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`));
  d.run(sql.raw(`CREATE INDEX IF NOT EXISTS audit_created_idx ON audit(created_at)`));
  _ensured = true;
}

function extractIp(req?: Request): string | null {
  if (!req) return null;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  return xri || null;
}

export function logAudit(action: string, target?: string | null, req?: Request) {
  try {
    ensureAuditTable();
    const ip = extractIp(req);
    const ua = req?.headers.get("user-agent") || null;
    db().run(
      sql`INSERT INTO audit (action, target, ip, user_agent) VALUES (${action}, ${target ?? null}, ${ip}, ${ua})`
    );
  } catch (e) {
    console.error("[audit] log error:", e);
  }
}

export type AuditRow = {
  id: number;
  action: string;
  target: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: number;
};

export function listAudit(limit = 50): AuditRow[] {
  ensureAuditTable();
  const d = db();
  const rows = (d as any).$client.prepare(`SELECT id, action, target, ip, user_agent, created_at FROM audit ORDER BY created_at DESC LIMIT ?`).all(limit) as AuditRow[];
  return rows;
}
