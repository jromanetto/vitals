import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!login|api/auth|api/health-check|_next|favicon|public|.*\\..*).*)",],
};

const IDLE_TTL = 60 * 15; // seconds

function buildRedirect(req: NextRequest, pathname: string, params: Record<string, string> = {}): URL {
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : req.nextUrl.origin;
  const url = new URL(pathname, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export function middleware(req: NextRequest) {
  const session = req.cookies.get("vitals_session")?.value;
  if (!session) {
    return NextResponse.redirect(buildRedirect(req, "/login", { from: req.nextUrl.pathname }));
  }
  const active = req.cookies.get("vitals_active")?.value;
  if (!active) {
    const res = NextResponse.redirect(buildRedirect(req, "/login", { reason: "idle" }));
    res.cookies.delete("vitals_session");
    return res;
  }

  const res = NextResponse.next();
  // Prevent Cloudflare/browser from caching app HTML — chunk hashes change at every build.
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  res.cookies.set("vitals_active", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: IDLE_TTL,
  });
  return res;
}
