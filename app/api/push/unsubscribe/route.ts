import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { endpoint?: string; id?: number } | null;
  if (!body?.id && !body?.endpoint) {
    return NextResponse.json({ error: "missing_endpoint_or_id" }, { status: 400 });
  }
  await convexServer().mutation(api.push.unsubscribe, {
    secret: bridgeSecret(),
    userId,
    id: body?.id != null ? Number(body.id) : undefined,
    endpoint: body?.endpoint,
  });
  return NextResponse.json({ ok: true });
}
