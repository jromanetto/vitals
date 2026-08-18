import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// RFC 7591 Dynamic Client Registration. Public PKCE clients only — no secret is
// issued. We don't persist a client registry: the flow is secured by PKCE, the
// redirect_uri allowlist, and user consent, so we simply mint a client_id and
// echo back the client's metadata.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* tolerate empty body */
  }
  const clientId = "vitals-" + crypto.randomBytes(8).toString("hex");
  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
      client_name: typeof body.client_name === "string" ? body.client_name : undefined,
    },
    { status: 201, headers: CORS },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
