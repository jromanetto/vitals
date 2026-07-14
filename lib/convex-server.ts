// Server-side bridge to Convex. The Next.js layer holds iron-session and is the
// only trusted caller: it proves identity server-side, then calls Convex public
// functions with SERVER_BRIDGE_SECRET (the browser never gets this secret).
//
// Config resolution (server-side):
//   URL    -> process.env.NEXT_PUBLIC_CONVEX_URL (.env.production on the VPS,
//             .env.local in dev) else data/auth.json { convexUrl }.
//   SECRET -> process.env.SERVER_BRIDGE_SECRET else data/auth.json
//             { serverBridgeSecret }. Secrets stay OUT of .env (project rule:
//             Next's dotenv-expand mangles `$`), so prod reads them from auth.json.
import { ConvexHttpClient } from "convex/browser";
import fs from "node:fs";
import path from "node:path";

let cached: ConvexHttpClient | null = null;
let creds: { convexUrl?: string; serverBridgeSecret?: string } | null = null;

function authFile(): { convexUrl?: string; serverBridgeSecret?: string } {
  if (creds) return creds;
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    creds = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    creds = {};
  }
  return creds!;
}

export function convexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || authFile().convexUrl;
  if (!url) throw new Error("Convex URL missing (NEXT_PUBLIC_CONVEX_URL or data/auth.json convexUrl)");
  return url;
}

export function convexServer(): ConvexHttpClient {
  if (!cached) cached = new ConvexHttpClient(convexUrl());
  return cached;
}

export function bridgeSecret(): string {
  const s = process.env.SERVER_BRIDGE_SECRET || authFile().serverBridgeSecret;
  if (!s) throw new Error("SERVER_BRIDGE_SECRET missing (env or data/auth.json serverBridgeSecret)");
  return s;
}
