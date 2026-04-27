/**
 * Shared accessor for the latest profile row.
 * Always returns DECRYPTED data so callers don't need to know about crypto.
 */
import { db } from "@/lib/db";
import { decryptProfile } from "@/lib/crypto-fields";

export function loadLatestProfile(): Record<string, unknown> {
  const sqlite = db().$client;
  const row = sqlite.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`).get() as { data: string } | undefined;
  if (!row) return {};
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(row.data); } catch { return {}; }
  return decryptProfile(parsed);
}

export function loadLatestProfileRaw(): { data: string; updated_at?: number } | undefined {
  const sqlite = db().$client;
  return sqlite.prepare(`SELECT data, updated_at FROM profile ORDER BY updated_at DESC LIMIT 1`).get() as { data: string; updated_at: number } | undefined;
}
