import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const ins = db().$client
    .prepare(`INSERT INTO report (kind, title, body, meta, user_id) VALUES (?, ?, ?, ?, ?)`)
    .run("doctor-pack", `Doctor Pack — génération…`, "", JSON.stringify({ status: "generating" }), s.userId);
  const id = Number(ins.lastInsertRowid);
  const cwd = process.cwd();
  const proc = spawn("node", [path.join(cwd, "scripts", "gen-doctor-pack.mjs"), String(id)], {
    cwd, detached: true, stdio: ["ignore", "ignore", "ignore"], env: process.env,
  });
  proc.unref();
  return NextResponse.json({ id, redirect: `/reports/${id}` });
}
