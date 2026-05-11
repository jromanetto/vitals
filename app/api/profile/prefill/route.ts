import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { decryptProfile } from "@/lib/crypto-fields";
import { computePrefill } from "@/lib/profile/prefill";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const row = sqlite
    .prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(userId) as { data: string } | undefined;
  const raw = row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : {};
  const current = decryptProfile(raw);
  const { patch, reasons } = computePrefill(userId, current);
  return NextResponse.json({ patch, reasons });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId))
    return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  ensureSchema();
  const body = await req.json().catch(() => ({}));
  const accepted = (body.accepted as string[] | undefined) ?? [];
  if (accepted.length === 0) return NextResponse.json({ ok: true, applied: 0 });

  const sqlite = db().$client;
  const row = sqlite
    .prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(userId) as { data: string } | undefined;
  const raw = row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : {};
  const current = decryptProfile(raw);
  const { patch } = computePrefill(userId, current);

  const next: Record<string, unknown> = { ...current };
  let applied = 0;
  for (const key of accepted) {
    if (key in patch) {
      next[key] = patch[key];
      applied++;
    }
  }
  // The /api/profile POST handler re-encrypts and writes. We delegate to it via
  // a direct insert to stay consistent with the existing pattern.
  sqlite
    .prepare(`INSERT INTO profile (data, updated_at, user_id) VALUES (?, ?, ?)`)
    .run(JSON.stringify(next), Date.now(), userId);
  return NextResponse.json({ ok: true, applied });
}
