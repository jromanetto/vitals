import { NextResponse } from "next/server";
import { getSession, currentUserId, isDemoUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";
import { sql } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const row = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as { data: string } | undefined;
  const data = row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : {};
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  ensureSchema();
  const body = await req.json();
  const data = body?.data ?? body;
  const sqlite = db().$client;
  sqlite.prepare(`INSERT INTO profile (data, updated_at, user_id) VALUES (?, ?, ?)`).run(JSON.stringify(data), Date.now(), userId);

  // also write a profile.md mirror for easy backup / offline reading
  const mdPath = path.join(process.cwd(), "data", "profile.md");
  await fs.mkdir(path.dirname(mdPath), { recursive: true });
  const md = renderMarkdown(data);
  await fs.writeFile(mdPath, md, "utf8");

  logAudit("profile_update", null, req);
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
