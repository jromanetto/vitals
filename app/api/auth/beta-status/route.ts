import { NextResponse } from "next/server";
import { betaStatus } from "@/lib/beta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/beta-status
 * Public. Lets the signup page show "beta open — N spots left" so visitors know
 * they can join without an invite. Never reveals the invite code or user list.
 */
export async function GET() {
  try {
    const s = await betaStatus();
    return NextResponse.json({ open: s.open, remaining: s.unlimited ? null : s.remaining });
  } catch {
    return NextResponse.json({ open: false, remaining: 0 });
  }
}
