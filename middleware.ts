import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    // Match everything except static files, _next, favicon, public — and
    // /api/upload, which streams large medical files (scans, imaging) that
    // exceed Next's ~10MB middleware body buffer; passing through middleware
    // truncated the body and broke `req.formData()`. The upload route does its
    // own getSession() auth check, so skipping middleware there is safe.
    "/((?!_next|favicon|public|api/upload|.*\\..*).*)",
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

// Path prefixes that are always public (api auth + health-check + cron).
// /api/cron/* endpoints are self-secured via CRON_SECRET header inside the route.
const PUBLIC_PREFIXES = ["/api/auth", "/api/health-check", "/legal/", "/share/", "/api/share/", "/api/cron/", "/api/csp-report"];

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

  // Note: we deliberately do NOT auto-redirect authenticated users away from /, /signup, /login.
  // - Demo users need to access /signup to upgrade to a real account.
  // - All users may legitimately want to revisit the landing or login pages.
  // The pages themselves render context-appropriate UI based on the session.

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
  // CSP in report-only mode — defense in depth. Cloudflare already sets HSTS,
  // X-Frame-Options, X-Content-Type-Options, Referrer-Policy. CSP is the only
  // missing layer. Started in report-only so we can watch /api/csp-report
  // collect violations for a week before flipping to enforce mode.
  res.headers.set(
    "Content-Security-Policy-Report-Only",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.anthropic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "report-uri /api/csp-report",
    ].join("; "),
  );
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  res.cookies.set("vitals_active", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: IDLE_TTL,
  });
  return res;
}
