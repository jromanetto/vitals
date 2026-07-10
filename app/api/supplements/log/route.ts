import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supplementId, date, taken } = await req.json() as { supplementId: number; date?: string; taken: boolean };
  await convexServer().mutation(api.supplements.setLog, {
    secret: bridgeSecret(),
    authUserId: userId,
    supplementId,
    date: date ?? undefined,
    taken,
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const supplementId = Number(url.searchParams.get("supplementId")) || undefined;
  const days = Number(url.searchParams.get("days") ?? "90");
  const res = await convexServer().query(api.supplements.logHistory, {
    secret: bridgeSecret(),
    authUserId,
    viewUserId: viewUserId ?? authUserId,
    supplementId,
    days,
  });
  return NextResponse.json(res);
}
