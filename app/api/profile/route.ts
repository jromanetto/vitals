import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const rows = await db().select().from(schema.profile).orderBy(sql`${schema.profile.updatedAt} desc`).limit(1);
  return NextResponse.json({ data: rows[0]?.data ?? {} });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const data = await req.json();
  const d = db();
  await d.insert(schema.profile).values({ data, updatedAt: new Date() });

  // also write a profile.md mirror for easy backup / offline reading
  const mdPath = path.join(process.cwd(), "data", "profile.md");
  await fs.mkdir(path.dirname(mdPath), { recursive: true });
  const md = renderMarkdown(data);
  await fs.writeFile(mdPath, md, "utf8");

  return NextResponse.json({ ok: true });
}

function renderMarkdown(d: Record<string, unknown>): string {
  const lines: string[] = ["# Profile", "", `_Last updated: ${new Date().toISOString()}_`, ""];
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    lines.push(`## ${k}`);
    if (Array.isArray(v)) lines.push(v.map((x) => `- ${x}`).join("\n"));
    else if (typeof v === "object") lines.push("```json\n" + JSON.stringify(v, null, 2) + "\n```");
    else lines.push(String(v));
    lines.push("");
  }
  return lines.join("\n");
}
