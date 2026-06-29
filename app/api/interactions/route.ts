import { NextResponse } from "next/server";
import { effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { findInteractions } from "@/lib/parsers/interactions";
import { decryptProfile } from "@/lib/crypto-fields";

export const runtime = "nodejs";

export async function GET() {
  const userId = await effectiveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const supplements = sqlite.prepare(`SELECT name FROM supplement WHERE ended_at IS NULL AND user_id = ?`).all(userId) as Array<{ name: string }>;
  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as { data: string } | undefined;
  const profile = profileRow ? decryptProfile(JSON.parse(profileRow.data)) : {};
  const meds = String(profile.medications ?? "").split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
  const interactions = findInteractions(supplements, meds);
  return NextResponse.json({ interactions, supplementCount: supplements.length, medicationCount: meds.length });
}
