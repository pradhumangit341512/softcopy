import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret');

const publicPaths = ['/login', '/signup', '/forgot-password', '/'];
const protectedPaths = ['/dashboard', '/api/clients', '/api/commissions', '/api/analytics'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path is public
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth_token')?.value;

  // Check if protected path
  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p));
  if (isProtectedPath) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify token
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};