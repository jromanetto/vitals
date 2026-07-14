import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Edit or delete a single biomarker measurement — lets users fix a wrong
 * extracted value or remove garbage. Strictly user_id-scoped (writes to self). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { value?: number; unit?: string | null; refLow?: number | null; refHigh?: number | null; date?: string };
  const patch: {
    value?: number; unit?: string | null; refLow?: number | null; refHigh?: number | null; date?: number;
  } = {};
  if (typeof body.value === "number" && Number.isFinite(body.value)) patch.value = body.value;
  if (body.unit === null || typeof body.unit === "string") patch.unit = body.unit;
  if (body.refLow === null || typeof body.refLow === "number") patch.refLow = body.refLow;
  if (body.refHigh === null || typeof body.refHigh === "number") patch.refHigh = body.refHigh;
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    const ms = Date.parse(body.date + "T00:00:00.000Z");
    if (Number.isFinite(ms)) patch.date = ms;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const res = await convexServer().mutation(api.biomarkers.updateMeasurement, {
    secret: bridgeSecret(), authUserId: userId, id, ...patch,
  });
  if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  logAudit("biomarker-edit", `id=${id} user=${userId}`, req);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const res = await convexServer().mutation(api.biomarkers.deleteMeasurement, {
    secret: bridgeSecret(), authUserId: userId, id,
  });
  if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  logAudit("biomarker-delete", `id=${id} user=${userId}`, req);
  return NextResponse.json({ ok: true });
}
