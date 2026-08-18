/**
 * Consent approval — the target of the /authorize consent form (native POST, so
 * the session cookie is carried by a top-level navigation, not a fetch). Mints a
 * single-use PKCE-bound authorization code and 303-redirects the browser to the
 * client's redirect_uri. If the session is missing/expired, it bounces to /login
 * (preserving the authorize request) so the flow self-heals instead of dead-
 * ending on a 401.
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
  ISSUER,
} from "@/lib/oauth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function field(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const clientId = field(fd, "clientId");
  const redirectUri = field(fd, "redirectUri");
  const codeChallenge = field(fd, "codeChallenge");
  const codeChallengeMethod = field(fd, "codeChallengeMethod");
  const state = field(fd, "state");

  if (!redirectUri || !isAllowedRedirect(redirectUri)) {
    return NextResponse.json({ error: "invalid redirect_uri" }, { status: 400 });
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return NextResponse.json({ error: "PKCE S256 required" }, { status: 400 });
  }

  const userId = await currentUserId();
  if (!userId) {
    // Session gone — rebuild the authorize request and send the user to log in;
    // they land back on the consent screen afterwards. Use the canonical public
    // origin: the app binds to 127.0.0.1 behind nginx, so req.nextUrl.origin is
    // the internal host and would redirect the browser to localhost.
    const authorize = buildRedirect(`${ISSUER}/authorize`, {
      response_type: "code",
      client_id: clientId || "claude",
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      ...(state ? { state } : {}),
    });
    const u = new URL(authorize);
    const login = new URL("/login", ISSUER);
    login.searchParams.set("from", u.pathname + u.search);
    return NextResponse.redirect(login, 303);
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

  return NextResponse.redirect(buildRedirect(redirectUri, state ? { code, state } : { code }), 303);
}
