import { NextResponse } from "next/server";
import { currentUserId, isDemoUser, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

export async function GET() {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await convexServer().query(api.supplements.list, {
    secret: bridgeSecret(),
    authUserId,
    viewUserId: viewUserId ?? authUserId,
  });
  // Parse ingredients JSON for each row (stored as a string in Convex).
  const rows = res.rows.map((r) => ({
    ...r,
    ingredients: r.ingredients ? safeParse(r.ingredients as string) : null,
  }));
  return NextResponse.json({ rows, takenToday: res.takenToday });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const body = await req.json();
  const ingredients = body.ingredients
    ? (typeof body.ingredients === "string" ? body.ingredients : JSON.stringify(body.ingredients))
    : null;
  const res = await convexServer().mutation(api.supplements.upsert, {
    secret: bridgeSecret(),
    authUserId: userId,
    id: body.id ?? undefined,
    name: body.name,
    dose: body.dose ?? null,
    unit: body.unit ?? null,
    timing: body.timing ?? null,
    frequency: body.frequency ?? null,
    startedAt: body.startedAt ?? null,
    endedAt: body.endedAt ?? null,
    notes: body.notes ?? null,
    targetBiomarker: body.targetBiomarker ?? null,
    targetSnp: body.targetSnp ?? null,
    url: body.url ?? null,
    brand: body.brand ?? null,
    imageUrl: body.imageUrl ?? null,
    ingredients,
    servingSize: body.servingSize ?? null,
    suggestedUse: body.suggestedUse ?? null,
    price: body.price ?? null,
    duration: body.duration ?? null,
  });
  return NextResponse.json(res);
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await convexServer().mutation(api.supplements.remove, { secret: bridgeSecret(), authUserId: userId, id });
  return NextResponse.json({ ok: true });
}
