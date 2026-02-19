import { auth } from "./auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnProtectedRoute = 
    req.nextUrl.pathname === "/" ||
    req.nextUrl.pathname.startsWith("/feeds") ||
    req.nextUrl.pathname.startsWith("/ai-mirror") ||
    req.nextUrl.pathname.startsWith("/sitemap-preview");

  if (isOnProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return undefined;
});

export const config = {
  matcher: [
    "/",
    "/feeds/:path*",
    "/ai-mirror/:path*",
    "/sitemap-preview/:path*",
  ],
};
