import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!login|api/auth|api/health-check|_next|favicon|public|.*\\..*).*)",],
};

const IDLE_TTL = 60 * 15; // seconds

export function middleware(req: NextRequest) {
  const session = req.cookies.get("vitals_session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const active = req.cookies.get("vitals_active")?.value;
  if (!active) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "idle");
    const res = NextResponse.redirect(url);
    res.cookies.delete("vitals_session");
    return res;
  }

  const res = NextResponse.next();
  res.cookies.set("vitals_active", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: IDLE_TTL,
  });
  return res;
}
