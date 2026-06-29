import { NextResponse } from "next/server";
import { getSession, currentUserId, isDemoUser , effectiveUserId} from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { encryptField, decryptField, isEncrypted } from "@/lib/crypto-fields";

export const runtime = "nodejs";

type NoteRow = {
  id: number;
  targetType: string;
  targetId: string;
  body: string;
  tags: string | null;
  createdAt: number;
  updatedAt: number;
};

function maskNote(row: NoteRow, unlock: boolean): NoteRow & { encrypted: boolean } {
  if (!isEncrypted(row.body)) return { ...row, encrypted: false };
  if (unlock) {
    try {
      return { ...row, body: decryptField(row.body), encrypted: true };
    } catch {
      return { ...row, body: "[verrouillé]", encrypted: true };
    }
  }
  return { ...row, body: "[verrouillé]", encrypted: true };
}

export async function GET(req: Request) {
  const userId = await effectiveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  const tag = url.searchParams.get("tag");
  const unlock = url.searchParams.get("unlock") === "1";
  const sqlite = db().$client;
  let rows: NoteRow[];
  if (targetType && targetId) {
    rows = sqlite.prepare(`SELECT id, target_type as targetType, target_id as targetId, body, tags, created_at as createdAt, updated_at as updatedAt FROM note WHERE user_id = ? AND target_type = ? AND target_id = ? ORDER BY created_at DESC`).all(userId, targetType, targetId) as NoteRow[];
  } else if (tag) {
    rows = sqlite.prepare(`SELECT id, target_type as targetType, target_id as targetId, body, tags, created_at as createdAt, updated_at as updatedAt FROM note WHERE user_id = ? AND tags LIKE ? ORDER BY created_at DESC`).all(userId, `%${tag}%`) as NoteRow[];
  } else {
    rows = sqlite.prepare(`SELECT id, target_type as targetType, target_id as targetId, body, tags, created_at as createdAt, updated_at as updatedAt FROM note WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`).all(userId) as NoteRow[];
  }
  const masked = rows.map((r) => maskNote(r, unlock));
  // Aggregate distinct tags
  const tagsRaw = sqlite.prepare(`SELECT tags FROM note WHERE user_id = ? AND tags IS NOT NULL AND tags != ''`).all(userId) as Array<{ tags: string }>;
  const tagSet = new Set<string>();
  for (const r of tagsRaw) for (const t of (r.tags ?? "").split(",")) {
    const tt = t.trim();
    if (tt) tagSet.add(tt);
  }
  return NextResponse.json({ rows: masked, tags: [...tagSet].sort() });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  ensureSchema();
  const body = await req.json() as { id?: number; targetType: string; targetId: string; body: string; tags?: string; private?: boolean };
  if (!body.targetType || !body.targetId || !body.body) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const sqlite = db().$client;
  const tags = (body.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).join(",");
  const now = Date.now();
  // If `private` flag is set, encrypt body. If body already encrypted, keep as-is.
  let storedBody = body.body;
  if (body.private && !isEncrypted(storedBody)) {
    storedBody = encryptField(storedBody);
  }
  if (body.id) {
    sqlite.prepare(`UPDATE note SET body = ?, tags = ?, updated_at = ? WHERE id = ? AND user_id = ?`).run(storedBody, tags, now, body.id, userId);
    return NextResponse.json({ ok: true, id: body.id });
  }
  const r = sqlite.prepare(`INSERT INTO note (target_type, target_id, body, tags, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(body.targetType, body.targetId, storedBody, tags, now, now, userId);
  return NextResponse.json({ ok: true, id: Number(r.lastInsertRowid) });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  ensureSchema();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db().$client.prepare(`DELETE FROM note WHERE user_id = ? AND id = ?`).run(userId, id);
  return NextResponse.json({ ok: true });
}

