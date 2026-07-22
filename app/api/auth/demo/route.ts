import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const DEMO_USER_ID = 999;
const DEMO_EMAIL = "demo@vitals.app";

export async function POST(req: Request) {
  // Confirm demo user exists (created by scripts/seed_demo.mjs)
  const { exists } = await convexServer().query(api.users.existsByLegacyId, {
    secret: bridgeSecret(), legacyId: DEMO_USER_ID,
  });
  if (!exists) {
    return NextResponse.json({ error: "demo non disponible — seed manquant" }, { status: 503 });
  }

  await setSession(DEMO_EMAIL, DEMO_USER_ID);
  logAudit("demo_login", `userId=${DEMO_USER_ID}`, req);
  return NextResponse.json({ ok: true });
}
