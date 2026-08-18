/**
 * OAuth token endpoint — exchanges a PKCE authorization code for an access
 * token. Public client (no secret): the code is validated, PKCE is verified,
 * and the redirect_uri must match the one bound at authorization time. The
 * issued access token IS an mcp_token, so /api/mcp needs no changes.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { generateToken, hashToken } from "@/lib/mcp/tokens";
import { verifyPkceS256, sha256Hex, SCOPE } from "@/lib/oauth/config";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const err = (code: string, status = 400) =>
  NextResponse.json({ error: code }, { status, headers: CORS });

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Token requests are form-encoded per spec, but tolerate JSON too.
  let params: Record<string, string> = {};
  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("application/json")) {
      params = (await req.json()) as Record<string, string>;
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) params[k] = String(v);
    }
  } catch {
    return err("invalid_request");
  }

  if (params.grant_type !== "authorization_code") return err("unsupported_grant_type");
  const { code, redirect_uri, code_verifier } = params;
  if (!code || !redirect_uri || !code_verifier) return err("invalid_request");

  // Validate + burn the code in one transaction.
  const consumed = await convexServer().mutation(api.oauthCode.consume, {
    secret: bridgeSecret(),
    codeHash: sha256Hex(code),
  });
  if (!consumed.ok || consumed.userId == null) return err("invalid_grant");
  if (consumed.redirectUri !== redirect_uri) return err("invalid_grant");
  if (!verifyPkceS256(code_verifier, consumed.codeChallenge || "")) return err("invalid_grant");

  // Mint the access token (an mcp_token, read-only, revocable in Profile > Security).
  const token = generateToken();
  await convexServer().mutation(api.mcpToken.issue, {
    secret: bridgeSecret(),
    authUserId: consumed.userId,
    tokenHash: hashToken(token),
    name: "Claude (OAuth)",
  });
  logAudit("oauth_token", `user=${consumed.userId}`);

  return NextResponse.json(
    { access_token: token, token_type: "Bearer", scope: SCOPE },
    { headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
