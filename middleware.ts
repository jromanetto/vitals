import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    // Match everything except static files, _next, favicon, public
    "/((?!_next|favicon|public|.*\\..*).*)",
  ],
};

const IDLE_TTL = 60 * 15; // seconds

// Public paths accessible without authentication
const PUBLIC_PATHS = new Set<string>([
  "/",
  "/login",
  "/signup",
  "/about",
  "/legal/privacy",
  "/legal/terms",
]);

// Path prefixes that are always public (api auth + health-check)
const PUBLIC_PREFIXES = ["/api/auth", "/api/health-check", "/legal/"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const p of PUBLIC_PREFIXES) {
    if (pathname.startsWith(p)) return true;
  }
  return false;
}

function buildRedirect(req: NextRequest, pathname: string, params: Record<string, string> = {}): URL {
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : req.nextUrl.origin;
  const url = new URL(pathname, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const session = req.cookies.get("vitals_session")?.value;
  const active = req.cookies.get("vitals_active")?.value;
  const isAuthed = Boolean(session && active);

  // Authenticated user landing on the public landing page → send to dashboard.
  if (isAuthed && pathname === "/") {
    return NextResponse.redirect(buildRedirect(req, "/dashboard"));
  }

  // Authenticated user visiting /login or /signup → send to dashboard too.
  if (isAuthed && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(buildRedirect(req, "/dashboard"));
  }

  // Public path → allow through, no auth required.
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Below: protected path.
  if (!session) {
    return NextResponse.redirect(buildRedirect(req, "/login", { from: pathname }));
  }
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
