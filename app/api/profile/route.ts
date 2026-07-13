import { NextResponse } from "next/server";
import { getSession, currentUserId, isDemoUser , effectiveUserId} from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { encryptProfile, decryptProfile } from "@/lib/crypto-fields";
import { logAudit } from "@/lib/audit";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

export async function GET() {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: stored } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId, viewUserId: viewUserId ?? authUserId,
  });
  const data = decryptProfile(stored ? JSON.parse(stored) : {});
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  const body = await req.json();
  const data = body?.data ?? body;
  await convexServer().mutation(api.profile.upsert, {
    secret: bridgeSecret(), authUserId: userId, data: JSON.stringify(encryptProfile(data)),
  });

  // also write a profile.md mirror for easy backup / offline reading — per-user
  // so one account's profile never overwrites another's on disk.
  const mdPath = path.join(process.cwd(), "data", "u", String(userId), "profile.md");
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
