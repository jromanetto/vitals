import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { row } = await convexServer().query(api.reports.get, {
    secret: bridgeSecret(), authUserId, viewUserId: viewUserId ?? authUserId, id: Number(id),
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  let meta: Record<string, unknown> = {};
  try { meta = row.meta ? (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta) : {}; } catch {}
  return NextResponse.json({ id: row.id, body: row.body, title: row.title, kind: row.kind, meta });
}
