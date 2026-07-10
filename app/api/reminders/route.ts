import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

type RawReminder = {
  id: number;
  title: string;
  description: string | null;
  dueAt: number;
  category: string | null;
  done: number;
  createdAt: number;
};

function enrich(row: RawReminder) {
  const now = Date.now();
  const daysUntil = Math.round((row.dueAt - now) / 86400000);
  const overdue = !row.done && row.dueAt < now;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    category: row.category,
    done: !!row.done,
    createdAt: row.createdAt,
    overdue,
    daysUntil,
  };
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rows } = await convexServer().query(api.reminders.list, { secret: bridgeSecret(), authUserId: userId });
  return NextResponse.json({ rows: (rows as RawReminder[]).map(enrich) });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const body = await req.json() as { title?: string; description?: string | null; dueAt?: number; category?: string | null };
  const title = (body.title ?? "").trim();
  const dueAt = Number(body.dueAt);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!Number.isFinite(dueAt) || dueAt <= 0) return NextResponse.json({ error: "dueAt required" }, { status: 400 });
  const description = body.description?.toString().trim() || null;
  const category = body.category?.toString().trim() || null;
  const { row } = await convexServer().mutation(api.reminders.create, {
    secret: bridgeSecret(), authUserId: userId, title, description, dueAt, category,
  });
  return NextResponse.json({ row: enrich(row as RawReminder) });
}

export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const body = await req.json() as { id?: number; done?: boolean };
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "id required" }, { status: 400 });
  const res = await convexServer().mutation(api.reminders.setDone, {
    secret: bridgeSecret(), authUserId: userId, id, done: !!body.done,
  });
  if (!res.row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ row: enrich(res.row as RawReminder) });
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "id required" }, { status: 400 });
  await convexServer().mutation(api.reminders.remove, { secret: bridgeSecret(), authUserId: userId, id });
  return NextResponse.json({ ok: true });
}
