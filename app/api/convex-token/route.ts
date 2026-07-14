import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { mintConvexToken } from "@/lib/convex-jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns a short-lived Convex JWT for the logged-in user, so the browser can
 * authenticate directly to Convex (reactive subscriptions). Proven by iron-session. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ token: mintConvexToken(userId) });
}
