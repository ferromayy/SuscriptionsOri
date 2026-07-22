import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/types";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    if (!hasSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (pathname.startsWith("/app")) {
    const isPublic =
      /^\/app\/[^/]+\/join\/?$/.test(pathname) ||
      /^\/app\/[^/]+\/login\/?$/.test(pathname);

    if (!hasSession && !isPublic) {
      const tenantMatch = pathname.match(/^\/app\/([^/]+)/);
      const tenantSlug = tenantMatch?.[1];
      if (tenantSlug) {
        const url = new URL(`/app/${tenantSlug}/login`, request.url);
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
      const url = new URL("/auth/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
