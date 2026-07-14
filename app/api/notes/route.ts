import { NextResponse } from "next/server";
import { currentUserId, isDemoUser, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { encryptField, decryptField, isEncrypted } from "@/lib/crypto-fields";

export const runtime = "nodejs";

type NoteRow = {
  id: number;
  targetType: string;
  targetId: string;
  body: string;
  tags: string | null;
  createdAt: number;
  updatedAt: number;
};

function maskNote(row: NoteRow, unlock: boolean): NoteRow & { encrypted: boolean } {
  if (!isEncrypted(row.body)) return { ...row, encrypted: false };
  if (unlock) {
    try {
      return { ...row, body: decryptField(row.body), encrypted: true };
    } catch {
      return { ...row, body: "[verrouillé]", encrypted: true };
    }
  }
  return { ...row, body: "[verrouillé]", encrypted: true };
}

export async function GET(req: Request) {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const targetType = url.searchParams.get("targetType") ?? undefined;
  const targetId = url.searchParams.get("targetId") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const unlock = url.searchParams.get("unlock") === "1";
  const res = await convexServer().query(api.notes.list, {
    secret: bridgeSecret(),
    authUserId,
    viewUserId: viewUserId ?? authUserId,
    targetType,
    targetId,
    tag,
  });
  const masked = (res.rows as NoteRow[]).map((r) => maskNote(r, unlock));
  return NextResponse.json({ rows: masked, tags: res.tags });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const body = await req.json() as { id?: number; targetType: string; targetId: string; body: string; tags?: string; private?: boolean };
  if (!body.targetType || !body.targetId || !body.body) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const tags = (body.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).join(",");
  // If `private`, encrypt body before it leaves the server. Already-encrypted stays as-is.
  let storedBody = body.body;
  if (body.private && !isEncrypted(storedBody)) storedBody = encryptField(storedBody);
  const res = await convexServer().mutation(api.notes.upsert, {
    secret: bridgeSecret(),
    authUserId: userId,
    id: body.id ?? undefined,
    targetType: body.targetType,
    targetId: body.targetId,
    body: storedBody,
    tags,
  });
  return NextResponse.json(res);
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await convexServer().mutation(api.notes.remove, { secret: bridgeSecret(), authUserId: userId, id });
  return NextResponse.json({ ok: true });
}
