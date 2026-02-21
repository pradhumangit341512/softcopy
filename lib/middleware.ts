import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// Public routes (no auth required)
const publicRoutes = ["/login", "/signup"];

// Protected UI routes
const protectedRoutes = ["/dashboard", "/clients", "/commission", "/invoice"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("auth_token")?.value;

  // ================= PUBLIC ROUTES =================
  // If user is logged in, prevent going back to login/signup
  if (publicRoutes.includes(pathname)) {
    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET!);
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } catch {
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  // ================= PROTECTED ROUTES =================
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

// Routes to apply middleware
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/commission/:path*",
    "/invoice/:path*",
    "/login",
    "/signup",
  ],
};
