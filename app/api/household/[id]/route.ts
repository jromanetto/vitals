import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Sever a household link. Either party may revoke: the viewer (stop following)
 * or the subject (withdraw consent). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const sqlite = db().$client;
  const r = sqlite.prepare(`DELETE FROM household_link WHERE id = ? AND (viewer_user_id = ? OR subject_user_id = ?)`).run(id, userId, userId);
  if (r.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  logAudit("household-revoke", `link=${id} by=${userId}`, req);
  return NextResponse.json({ ok: true });
}
