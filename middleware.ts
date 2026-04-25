import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!login|api/auth|api/health-check|_next|favicon|public|.*\..*).*)",],
};

export function middleware(req: NextRequest) {
  const session = req.cookies.get("vitals_session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
