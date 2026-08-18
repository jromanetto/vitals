/**
 * Manage personal access tokens for the MCP server. The plaintext token is
 * returned exactly once, at creation; afterwards only its hash exists.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { generateToken, hashToken } from "@/lib/mcp/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rows } = await convexServer().query(api.mcpToken.list, { secret: bridgeSecret(), authUserId: userId });
  return NextResponse.json({ tokens: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Indisponible en mode démo." }, { status: 403 });

  let name: string | undefined;
  try {
    const b = await req.json();
    if (typeof b?.name === "string" && b.name.trim()) name = b.name.trim().slice(0, 60);
  } catch {
    /* body optional */
  }

  const token = generateToken();
  const { id } = await convexServer().mutation(api.mcpToken.issue, {
    secret: bridgeSecret(),
    authUserId: userId,
    tokenHash: hashToken(token),
    name,
  });
  logAudit("mcp_token_create", `id=${id}${name ? ` name=${name}` : ""}`);
  // The one and only time the plaintext leaves the server.
  return NextResponse.json({ id, name: name ?? null, token });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { ok } = await convexServer().mutation(api.mcpToken.revoke, {
    secret: bridgeSecret(),
    authUserId: userId,
    id: id as never, // Convex Id<"mcp_token"> string round-tripped from list
  });
  if (ok) logAudit("mcp_token_revoke", `id=${id}`);
  return NextResponse.json({ ok });
}
