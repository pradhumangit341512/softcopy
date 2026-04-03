import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/'];

const publicApiPaths = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/api/auth/otp',
  '/api/auth/send-email-otp',
  '/api/auth/verify-email-otp',
  '/api/auth/reset-password',
  '/api/auth/forgot-password',
  '/api/webhooks/razorpay',
  '/api/cron/cleanup-otp',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isPublicPage = publicPaths.some((p) =>
    p === '/' ? pathname === '/' : pathname.startsWith(p)
  );
  if (isPublicPage) return NextResponse.next();

  const isPublicApi = publicApiPaths.some((p) => pathname.startsWith(p));
  if (isPublicApi) return NextResponse.next();

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
