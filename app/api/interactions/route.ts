import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { findInteractions } from "@/lib/parsers/interactions";
import { decryptProfile } from "@/lib/crypto-fields";

export const runtime = "nodejs";

export async function GET() {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const readViewUserId = viewUserId ?? authUserId;

  const { rows: allSups } = await convexServer().query(api.supplements.list, {
    secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
  });
  // Legacy: active supplements only (ended_at IS NULL).
  const supplements = allSups
    .filter((r) => (r.endedAt as number | null) == null)
    .map((r) => ({ name: (r.name as string) ?? "" }));

  // profile has no Convex fn yet — stays on SQLite (matches recommendations route).
  ensureSchema();
  const sqlite = db().$client;
  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(readViewUserId) as { data: string } | undefined;
  const profile = profileRow ? decryptProfile(JSON.parse(profileRow.data)) : {};
  const meds = String(profile.medications ?? "").split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
  const interactions = findInteractions(supplements, meds);
  return NextResponse.json({ interactions, supplementCount: supplements.length, medicationCount: meds.length });
}
