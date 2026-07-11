import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const sessionId = Number(id);
  // Make sure the chat session belongs to this user before returning messages.
  const owner = await convexServer().query(api.chat.sessionOwner, {
    secret: bridgeSecret(), sessionId,
  });
  if (owner.userId === null || owner.userId !== userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { rows } = await convexServer().query(api.chat.listMessages, {
    secret: bridgeSecret(), sessionId, order: "asc",
  });
  const messages = rows.map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources, created_at: m.createdAt }));
  return NextResponse.json({ messages });
}
