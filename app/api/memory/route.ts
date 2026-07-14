import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["fact", "preference", "goal", "concern", "medical_history"]);

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rows } = await convexServer().query(api.chat.listMemory, {
    secret: bridgeSecret(), authUserId: s.userId,
  });
  // Preserve legacy ordering: active DESC, kind ASC, created_at DESC.
  const sorted = rows.slice().sort((a, b) => {
    if (a.active !== b.active) return b.active - a.active;
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  const memories = sorted.map((m) => ({
    id: m.id,
    kind: m.kind,
    body: m.body,
    source_session_id: m.sourceSessionId,
    confidence: m.confidence,
    created_at: m.createdAt,
    active: m.active,
  }));
  return NextResponse.json({ memories });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { id?: number; kind?: string; body?: string; confidence?: number; active?: number };
  const convex = convexServer();
  const secret = bridgeSecret();

  if (body.id) {
    // Update existing memory. Collect validated field changes.
    const updates: { kind?: string; body?: string; confidence?: number; active?: number } = {};
    if (body.kind && ALLOWED_KINDS.has(body.kind)) updates.kind = body.kind;
    if (typeof body.body === "string") updates.body = body.body.slice(0, 500);
    if (typeof body.confidence === "number") updates.confidence = Math.min(Math.max(body.confidence, 0), 1);
    if (typeof body.active === "number") updates.active = body.active ? 1 : 0;
    if (!Object.keys(updates).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

    // In-place content edit (preserves id/created_at) via api.chat.updateMemory.
    if (updates.kind !== undefined || updates.body !== undefined || updates.confidence !== undefined) {
      await convex.mutation(api.chat.updateMemory, {
        secret, authUserId: s.userId, id: body.id,
        kind: updates.kind, body: updates.body, confidence: updates.confidence,
      });
    }
    if (updates.active !== undefined) {
      await convex.mutation(api.chat.setMemoryActive, {
        secret, authUserId: s.userId, id: body.id, active: updates.active === 1,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // Create new memory
  if (!body.kind || !ALLOWED_KINDS.has(body.kind)) return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  if (!body.body || typeof body.body !== "string") return NextResponse.json({ error: "body required" }, { status: 400 });
  const { id } = await convex.mutation(api.chat.insertMemory, {
    secret, authUserId: s.userId, kind: body.kind, body: body.body.slice(0, 500), confidence: body.confidence ?? 0.9,
  });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await convexServer().mutation(api.chat.deleteMemory, {
    secret: bridgeSecret(), authUserId: s.userId, id,
  });
  return NextResponse.json({ ok: true });
}
