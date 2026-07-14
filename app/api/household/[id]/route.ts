import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Sever a household link. Either party may revoke: the viewer (stop following)
 * or the subject (withdraw consent). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const res = await convexServer().mutation(api.household.remove, { secret: bridgeSecret(), userId, id });
  if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  logAudit("household-revoke", `link=${id} by=${userId}`, req);
  return NextResponse.json({ ok: true });
}
