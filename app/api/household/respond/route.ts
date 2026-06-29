import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Approve or reject a request to view MY data. Only the subject (the person
 * whose data would be exposed) can respond — this is the consent gate. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  ensureSchema();

  const body = await req.json().catch(() => ({})) as { id?: number; action?: string };
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (body.action !== "approve" && body.action !== "reject") return NextResponse.json({ error: "bad action" }, { status: 400 });

  const sqlite = db().$client;
  // Ownership: only act on a pending request where *I* am the subject.
  const link = sqlite.prepare(`SELECT id FROM household_link WHERE id = ? AND subject_user_id = ? AND status = 'pending'`).get(id, userId);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (body.action === "approve") {
    sqlite.prepare(`UPDATE household_link SET status = 'active', responded_at = unixepoch() * 1000 WHERE id = ? AND subject_user_id = ?`).run(id, userId);
    logAudit("household-approve", `link=${id} subject=${userId}`, req);
  } else {
    sqlite.prepare(`DELETE FROM household_link WHERE id = ? AND subject_user_id = ?`).run(id, userId);
    logAudit("household-reject", `link=${id} subject=${userId}`, req);
  }
  return NextResponse.json({ ok: true });
}
