import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { logAudit } from "@/lib/audit";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Create the placeholder report in Convex, owned by the requesting user.
  const { id } = await convexServer().mutation(api.reports.insert, {
    secret: bridgeSecret(), authUserId: s.userId, kind: "doctor-pack",
    title: "Doctor Pack — génération…", body: "",
    meta: JSON.stringify({ status: "generating" }), status: "generating",
  });
  // Detached worker generates + writes the body back via Convex (bypasses the CF
  // 60s timeout). userId is passed so the worker scopes its Convex reads to the owner.
  const cwd = process.cwd();
  const proc = spawn("node", [path.join(cwd, "scripts", "gen-doctor-pack.mjs"), String(id), String(s.userId)], {
    cwd, detached: true, stdio: ["ignore", "ignore", "ignore"], env: process.env,
  });
  proc.unref();
  logAudit("report_create", `id=${id} kind=doctor-pack`, req);
  return NextResponse.json({ id, redirect: `/reports/${id}` });
}
