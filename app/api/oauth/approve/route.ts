/**
 * Consent approval — called by the /authorize page after the logged-in user
 * clicks "Autoriser". Session-guarded: the code is bound to the authenticated
 * user. Mints a single-use authorization code (PKCE-bound) and returns the
 * redirect URL the browser should navigate to.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUserId } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import {
  isAllowedRedirect,
  generateAuthCode,
  sha256Hex,
  buildRedirect,
  CODE_TTL_MS,
  SCOPE,
} from "@/lib/oauth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let b: {
    clientId?: string;
    redirectUri?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    state?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { clientId, redirectUri, codeChallenge, codeChallengeMethod, state } = b;
  if (!redirectUri || !isAllowedRedirect(redirectUri)) {
    return NextResponse.json({ error: "invalid redirect_uri" }, { status: 400 });
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return NextResponse.json({ error: "PKCE S256 required" }, { status: 400 });
  }

  const code = generateAuthCode();
  await convexServer().mutation(api.oauthCode.issue, {
    secret: bridgeSecret(),
    codeHash: sha256Hex(code),
    userId,
    clientId: clientId || "unknown",
    redirectUri,
    codeChallenge,
    scope: SCOPE,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  logAudit("oauth_authorize", `client=${clientId || "?"}`);

  const url = buildRedirect(redirectUri, state ? { code, state } : { code });
  return NextResponse.json({ redirectUrl: url });
}
