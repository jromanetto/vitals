import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { getVapidPublicKey } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const publicKey = getVapidPublicKey();
  if (!publicKey) return NextResponse.json({ error: "vapid_not_configured" }, { status: 500 });
  return NextResponse.json({ publicKey });
}
