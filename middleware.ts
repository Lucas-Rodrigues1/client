import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const jwt = request.cookies.get("auth_token")?.value || request.nextUrl.searchParams.get("token") || null;
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (!jwt && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (jwt && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/login", "/signup"],
};
