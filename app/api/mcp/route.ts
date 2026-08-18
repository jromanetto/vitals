/**
 * Vitals MCP server — read-only access to the caller's own health data for
 * their Claude app. Stateless Streamable-HTTP transport (POST JSON-RPC → JSON).
 * Authenticated by a personal access token (Bearer), resolved to a userId that
 * scopes every tool. No session cookie involved; middleware lets /api/mcp
 * through so this route owns auth.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleMcpBody, type JsonRpcResponse } from "@/lib/mcp/protocol";
import { buildTools } from "@/lib/mcp/tools";
import { resolveTokenToUser } from "@/lib/mcp/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER = {
  name: "vitals",
  version: "1.0.0",
  instructions:
    "Accès lecture seule aux données de santé de l'utilisateur (biomarqueurs, ADN, suppléments, score longévité, rapports, symptômes). Utilise ces données pour un conseil personnalisé. Vitals n'est pas un dispositif médical.",
};

// Permissive CORS so claude.ai's web connector can reach the endpoint; the real
// gate is the Bearer token, not the origin.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function unauthorized(): NextResponse {
  // Advertise the protected-resource metadata (RFC 9728) so an MCP client can
  // discover the OAuth authorization server and start the connector flow.
  const wwwAuth = `Bearer realm="vitals-mcp", resource_metadata="https://vitals.club/.well-known/oauth-protected-resource"`;
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: valid Bearer token required" } },
    { status: 401, headers: { ...CORS, "WWW-Authenticate": wwwAuth } },
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// SSE stream not supported in stateless mode — clients fall back to POST.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Method Not Allowed: use POST" } },
    { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await resolveTokenToUser(bearer(req));
  if (userId == null) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS },
    );
  }

  const tools = buildTools(userId);
  const result: JsonRpcResponse | JsonRpcResponse[] | null = await handleMcpBody(body, SERVER, tools);

  // A lone notification produces no response body.
  if (result == null) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(result, { headers: CORS });
}
