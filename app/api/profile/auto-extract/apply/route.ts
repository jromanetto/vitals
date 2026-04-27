import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { decryptProfile } from "@/lib/crypto-fields";
import { logAudit } from "@/lib/audit";
import { desc } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();

  const body = (await req.json()) as { fields?: Record<string, unknown>; memories?: string[] };
  const fields = body.fields ?? {};
  const memories = Array.isArray(body.memories) ? body.memories.filter((x) => typeof x === "string") : [];

  const d = db();
  const rows = await d.select().from(schema.profile).orderBy(desc(schema.profile.updatedAt)).limit(1);
  const existing = decryptProfile((rows[0]?.data as Record<string, unknown>) ?? {});

  const merged: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    merged[k] = v;
  }

  // Match /api/profile POST behaviour: store plaintext (legacy)
  await d.insert(schema.profile).values({ data: merged, updatedAt: new Date() });

  // Mirror profile.md
  try {
    const mdPath = path.join(process.cwd(), "data", "profile.md");
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
    const sqlite = d.$client;
    const dedup = sqlite.prepare(`SELECT id FROM chat_memory WHERE kind = ? AND body = ? LIMIT 1`);
    const ins = sqlite.prepare(`INSERT INTO chat_memory (kind, body, source_session_id, confidence, created_at, active) VALUES (?, ?, NULL, ?, ?, 1)`);
    for (const m of memories) {
      const trimmed = m.trim().slice(0, 500);
      if (!trimmed) continue;
      const exists = dedup.get("medical_history", trimmed);
      if (exists) continue;
      ins.run("medical_history", trimmed, 0.9, Date.now());
      memCreated++;
    }
  }

  logAudit("profile_auto_extract_apply", `fields=${Object.keys(fields).length} memories=${memCreated}`, req);
  return NextResponse.json({ ok: true, fieldsApplied: Object.keys(fields).length, memoriesCreated: memCreated });
}
