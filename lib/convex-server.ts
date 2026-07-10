// Server-side bridge to Convex. The Next.js layer holds iron-session and is the
// only trusted caller: it proves identity server-side, then calls Convex public
// functions with SERVER_BRIDGE_SECRET (the browser never gets this secret).
//
// Interim until Phase 8 (Convex Auth) enables direct browser->Convex + reactivity.
import { ConvexHttpClient } from "convex/browser";

let cached: ConvexHttpClient | null = null;

export function convexServer(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL missing (Convex not configured)");
  if (!cached) cached = new ConvexHttpClient(url);
  return cached;
}

export function bridgeSecret(): string {
  const s = process.env.SERVER_BRIDGE_SECRET;
  if (!s) throw new Error("SERVER_BRIDGE_SECRET missing (Convex bridge not configured)");
  return s;
}
