import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cwd = process.cwd();
  const tsx = path.join(cwd, "node_modules", ".bin", "tsx");
  const script = path.join(cwd, "scripts", "ingest.ts");

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(tsx, [script], { cwd, env: process.env });
    let stdout = ""; let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      logAudit("ingest", `code=${code}`, req);
      resolve(NextResponse.json({ ok: code === 0, code, stdout, stderr: stderr.slice(-2000) }));
    });
  });
}

export async function POST(req: Request) { return run(req); }
export async function GET(req: Request) { return run(req); }
