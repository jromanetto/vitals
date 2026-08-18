/**
 * OAuth 2.0 + PKCE helpers for the MCP connector flow. Public-client model
 * (no client secret): security comes from PKCE (S256), a redirect_uri
 * allowlist, and a user-consent step gated by the Vitals session.
 */
import crypto from "node:crypto";

/** Canonical issuer / resource base. */
export const ISSUER = "https://vitals.club";
export const MCP_RESOURCE = `${ISSUER}/api/mcp`;
export const SCOPE = "read";
export const CODE_TTL_MS = 10 * 60 * 1000;

// Hosts allowed as redirect targets. Claude's native connector uses
// claude.ai/claude.com; localhost covers the mcp-remote / desktop bridge.
const ALLOWED_HOSTS = new Set(["claude.ai", "claude.com", "localhost", "127.0.0.1"]);

/** Accept a redirect_uri only if its host is allowlisted (https, or http on
 * loopback). Prevents authorization codes being sent to an attacker origin. */
export function isAllowedRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (!ALLOWED_HOSTS.has(u.hostname)) return false;
    const loopback = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    return u.protocol === "https:" || (loopback && u.protocol === "http:");
  } catch {
    return false;
  }
}

const b64url = (b: Buffer) => b.toString("base64url");

/** Verify a PKCE code_verifier against the stored S256 challenge. */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const computed = b64url(crypto.createHash("sha256").update(verifier).digest());
  // constant-time compare on equal-length buffers
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function generateAuthCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Append query params to a redirect_uri, preserving any it already has. */
export function buildRedirect(redirectUri: string, params: Record<string, string>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}
