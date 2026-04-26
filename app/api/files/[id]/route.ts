import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const { id } = await params;
  const row = db().$client.prepare(`SELECT id, path, title, category FROM document WHERE id = ?`).get(Number(id)) as { id: number; path: string; title: string | null; category: string } | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Sanitize path: must be inside data/
  const dataDir = path.resolve(process.cwd(), "data");
  const filePath = path.resolve(row.path);
  if (!filePath.startsWith(dataDir)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const ct = ext === ".pdf" ? "application/pdf" : "application/octet-stream";
    return new NextResponse(buf, {
      status: 200,
      headers: { "Content-Type": ct, "Content-Disposition": `inline; filename="${path.basename(filePath)}"` },
    });
  } catch {
    return NextResponse.json({ error: "file gone" }, { status: 404 });
  }
}
