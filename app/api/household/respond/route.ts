import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Approve or reject a request to view MY data. Only the subject (the person
 * whose data would be exposed) can respond — this is the consent gate. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { id?: number; action?: string };
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (body.action !== "approve" && body.action !== "reject") return NextResponse.json({ error: "bad action" }, { status: 400 });

  const res = await convexServer().mutation(api.household.respond, {
    secret: bridgeSecret(), subjectId: userId, id, approve: body.action === "approve",
  });
  if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  logAudit(body.action === "approve" ? "household-approve" : "household-reject", `link=${id} subject=${userId}`, req);
  return NextResponse.json({ ok: true });
}
