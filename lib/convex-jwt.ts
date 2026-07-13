// Mints a short-lived RS256 JWT that authenticates a logged-in user to Convex
// directly from the browser (custom JWT provider in convex/auth.config.ts).
// Signed with the private key in data/auth.json; iron-session remains the source
// of truth for WHO is logged in (this just vouches for that user to Convex).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ISSUER = "https://vitals.club";
const AUDIENCE = "vitals";
const TTL_SEC = 3600;

function creds(): { key: string; kid: string } {
  const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
  const a = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!a.convexJwtPrivateKey) throw new Error("convexJwtPrivateKey missing in data/auth.json");
  return { key: a.convexJwtPrivateKey, kid: a.convexJwtKid || "vitals-1" };
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Sign a Convex-compatible JWT for `userId`. `sub` is the numeric user id as a string. */
export function mintConvexToken(userId: number): string {
  const { key, kid } = creds();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const payload = b64url(JSON.stringify({ iss: ISSUER, aud: AUDIENCE, sub: String(userId), iat: now, exp: now + TTL_SEC }));
  const sig = crypto.createSign("RSA-SHA256").update(`${header}.${payload}`).sign(key);
  return `${header}.${payload}.${b64url(sig)}`;
}
