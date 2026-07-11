import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rows } = await convexServer().query(api.chat.listSessions, {
    secret: bridgeSecret(), authUserId: userId,
  });
  const sessions = rows.map((s) => ({ id: s.id, title: s.title, created_at: s.createdAt, updated_at: s.updatedAt }));
  return NextResponse.json({ sessions });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Verify the session belongs to the current user before deleting.
  const owner = await convexServer().query(api.chat.sessionOwner, {
    secret: bridgeSecret(), sessionId: id,
  });
  if (owner.userId === null || owner.userId !== userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  await convexServer().mutation(api.chat.deleteSession, {
    secret: bridgeSecret(), authUserId: userId, sessionId: id,
  });
  return NextResponse.json({ ok: true });
}
