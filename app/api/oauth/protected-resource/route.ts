import { NextResponse } from "next/server";
import { ISSUER, MCP_RESOURCE, SCOPE } from "@/lib/oauth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

// RFC 9728 protected-resource metadata — tells the client which authorization
// server guards the MCP endpoint. Reached via a /.well-known rewrite.
export function GET() {
  return NextResponse.json(
    {
      resource: MCP_RESOURCE,
      authorization_servers: [ISSUER],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
    },
    { headers: CORS },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Headers": "*" } });
}
