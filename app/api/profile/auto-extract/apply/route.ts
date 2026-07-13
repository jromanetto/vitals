import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { encryptProfile, decryptProfile } from "@/lib/crypto-fields";
import { logAudit } from "@/lib/audit";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { fields?: Record<string, unknown>; memories?: string[] };
  const fields = body.fields ?? {};
  const memories = Array.isArray(body.memories) ? body.memories.filter((x) => typeof x === "string") : [];

  const { data: profileStored } = await convexServer().query(api.profile.get, {
    secret: bridgeSecret(), authUserId: s.userId, viewUserId: s.userId,
  });
  const existing = decryptProfile(profileStored ? JSON.parse(profileStored) : {});

  const merged: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    merged[k] = v;
  }

  // Match /api/profile POST behaviour: encrypt sensitive fields at rest, scoped to the user.
  await convexServer().mutation(api.profile.upsert, {
    secret: bridgeSecret(), authUserId: s.userId, data: JSON.stringify(encryptProfile(merged)),
  });

  // Mirror profile.md — per-user so accounts don't overwrite each other on disk.
  try {
    const mdPath = path.join(process.cwd(), "data", "u", String(s.userId), "profile.md");
    await fs.mkdir(path.dirname(mdPath), { recursive: true });
    const lines: string[] = ["# Profile", "", `_Last updated: ${new Date().toISOString()}_`, ""];
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      lines.push(`## ${k}`);
      if (Array.isArray(v)) lines.push(v.map((x) => `- ${x}`).join("\n"));
      else if (typeof v === "object") lines.push("\`\`\`json\n" + JSON.stringify(v, null, 2) + "\n\`\`\`");
      else lines.push(String(v));
      lines.push("");
    }
    await fs.writeFile(mdPath, lines.join("\n"), "utf8");
  } catch {}

  // Insert memories with kind=medical_history, dedup
  let memCreated = 0;
  if (memories.length) {
    const secret = bridgeSecret();
    for (const m of memories) {
      const trimmed = m.trim().slice(0, 500);
      if (!trimmed) continue;
      const { exists } = await convexServer().query(api.chat.memoryExists, {
        secret, authUserId: s.userId, kind: "medical_history", body: trimmed,
      });
      if (exists) continue;
      await convexServer().mutation(api.chat.insertMemory, {
        secret, authUserId: s.userId, kind: "medical_history", body: trimmed, confidence: 0.9,
      });
      memCreated++;
    }
  }

  logAudit("profile_auto_extract_apply", `fields=${Object.keys(fields).length} memories=${memCreated}`, req);
  return NextResponse.json({ ok: true, fieldsApplied: Object.keys(fields).length, memoriesCreated: memCreated });
}
