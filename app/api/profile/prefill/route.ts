import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { decryptProfile } from "@/lib/crypto-fields";
import { computePrefill } from "@/lib/profile/prefill";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const raw = data ? JSON.parse(data) : {};
  const current = decryptProfile(raw);
  const { patch, reasons } = await computePrefill(userId, current);
  return NextResponse.json({ patch, reasons });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId))
    return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const accepted = (body.accepted as string[] | undefined) ?? [];
  if (accepted.length === 0) return NextResponse.json({ ok: true, applied: 0 });

  const { data } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: userId, viewUserId: userId,
  });
  const raw = data ? JSON.parse(data) : {};
  const current = decryptProfile(raw);
  const { patch } = await computePrefill(userId, current);

  const next: Record<string, unknown> = { ...current };
  let applied = 0;
  for (const key of accepted) {
    if (key in patch) {
      next[key] = patch[key];
      applied++;
    }
  }
  await convexServer().mutation(api.profile.upsert, {
    secret: bridgeSecret(), authUserId: userId, data: JSON.stringify(next),
  });
  return NextResponse.json({ ok: true, applied });
}
