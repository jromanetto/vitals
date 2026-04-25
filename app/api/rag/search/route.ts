import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/db/migrate";
import { searchRag } from "@/lib/rag/search";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const hits = await searchRag(q, 20);
  return NextResponse.json({ hits });
}
