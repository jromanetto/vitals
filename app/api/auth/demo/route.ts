import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

const DEMO_USER_ID = 999;
const DEMO_EMAIL = "demo@vitals.app";

export async function POST(req: Request) {
  ensureSchema();
  // Confirm demo user exists (created by scripts/seed_demo.mjs)
  const sqlite = db().$client;
  const row = sqlite.prepare(`SELECT id FROM user WHERE id = ?`).get(DEMO_USER_ID) as { id: number } | undefined;
  if (!row) {
    return NextResponse.json({ error: "demo non disponible — seed manquant" }, { status: 503 });
  }

  await setSession(DEMO_EMAIL, DEMO_USER_ID);
  logAudit("demo_login", `userId=${DEMO_USER_ID}`, req);
  return NextResponse.json({ ok: true });
}
