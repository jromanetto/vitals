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
  const days = Math.min(365, Number(url.searchParams.get("days") ?? "90"));
  const res = await convexServer().query(api.symptoms.list, {
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
  const body = await req.json() as { date?: string; key: string; value: number; notes?: string };
  const d = body.date ?? new Date().toISOString().slice(0, 10);
  if (!body.key || typeof body.value !== "number") return NextResponse.json({ error: "key+value required" }, { status: 400 });
  await convexServer().mutation(api.symptoms.set, {
    secret: bridgeSecret(),
    authUserId: userId,
    date: d,
    key: body.key,
    value: body.value,
    notes: body.notes ?? null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await convexServer().mutation(api.symptoms.remove, { secret: bridgeSecret(), authUserId: userId, id });
  return NextResponse.json({ ok: true });
}
