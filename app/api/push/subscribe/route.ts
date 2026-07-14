import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    | null;

  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const auth = body?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent") ?? null;
  await convexServer().mutation(api.push.subscribe, {
    secret: bridgeSecret(), userId, endpoint, p256dh, auth, userAgent: ua,
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rows } = await convexServer().query(api.push.listForUser, { secret: bridgeSecret(), userId });
  return NextResponse.json({ rows });
}
