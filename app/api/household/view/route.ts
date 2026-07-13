import { NextResponse } from "next/server";
import { currentUserId, hasActiveLink, setViewUser, clearViewUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Switch the active "view as" profile. Passing my own id (or null) clears the
 * view. Switching to a member requires an active, consented link — validated
 * here AND re-validated on every read via effectiveUserId(). */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { subjectId?: number | null };
  const subjectId = body.subjectId == null ? null : Number(body.subjectId);

  if (subjectId == null || subjectId === userId) {
    await clearViewUser();
    return NextResponse.json({ ok: true, viewingId: userId, viewingSelf: true });
  }
  if (!Number.isFinite(subjectId) || !(await hasActiveLink(userId, subjectId))) {
    return NextResponse.json({ error: "Profil non autorisé" }, { status: 403 });
  }
  await setViewUser(subjectId);
  return NextResponse.json({ ok: true, viewingId: subjectId, viewingSelf: false });
}
