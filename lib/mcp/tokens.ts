import crypto from "node:crypto";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

const PREFIX = "vitals_mcp_";

/** Mint a fresh opaque personal access token. Shown once, never stored. */
export function generateToken(): string {
  return PREFIX + crypto.randomBytes(24).toString("base64url");
}

/** Stored form — a database read cannot be turned back into a usable token. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Resolve a bearer token to its user id (bumping lastUsedAt), or null if the
 * token is unknown/revoked/malformed. Never throws.
 */
export async function resolveTokenToUser(token: string | null | undefined): Promise<number | null> {
  if (!token || !token.startsWith(PREFIX)) return null;
  try {
    const { userId } = await convexServer().mutation(api.mcpToken.resolve, {
      secret: bridgeSecret(),
      tokenHash: hashToken(token),
    });
    return typeof userId === "number" ? userId : null;
  } catch {
    return null;
  }
}
