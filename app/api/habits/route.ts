import { NextResponse } from "next/server";
import { currentUserId, isDemoUser, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const days = Math.min(365, Number(url.searchParams.get("days") ?? "60"));
  const res = await convexServer().query(api.habits.list, {
    secret: bridgeSecret(),
    authUserId,
    viewUserId: viewUserId ?? authUserId,
    days,
  });
  return NextResponse.json({ rows: res.rows });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const { date, key, value } = await req.json() as { date?: string; key: string; value: number };
  const d = date ?? new Date().toISOString().slice(0, 10);
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  await convexServer().mutation(api.habits.set, {
    secret: bridgeSecret(),
    authUserId: userId,
    date: d,
    key,
    value: value ?? 1,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const key = url.searchParams.get("key");
  if (!date || !key) return NextResponse.json({ error: "date+key required" }, { status: 400 });
  await convexServer().mutation(api.habits.remove, {
    secret: bridgeSecret(),
    authUserId: userId,
    date,
    key,
  });
  return NextResponse.json({ ok: true });
}
