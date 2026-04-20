import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET must be set and at least 32 characters long.'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const JWT_ALGS = ['HS256'] as const;

// Public-signup pivot (April 2026): /signup is gone. Only YOU (superadmin)
// create accounts via /superadmin/companies/new. /forgot-password stays — it
// only works for emails that already exist in the DB.
const publicPaths = ['/login', '/forgot-password', '/reset-password', '/'];

const publicApiPaths = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/otp',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/send-email-otp',
  '/api/auth/verify-email-otp',
  '/api/auth/reset-password',
  '/api/webhooks/razorpay',
  '/api/cron/cleanup-otp',
  '/api/cron/cleanup-expired',
  '/api/cron/cleanup-sessions',
  '/api/dev/verify-user',
  '/api/dev/restore-data',
  '/api/dev/backfill-fields',
  '/api/dev/run-migrations',
];

// Routes that still work even with an expired subscription:
// - auth/me + auth/logout so the user can see the expired state and log out
// - subscriptions + create-order so they can actually pay to renew
const subscriptionExemptApis = [
  '/api/auth/me',
  '/api/auth/logout',
  '/api/subscriptions',
  '/api/create-order',
];

type TokenClaims = JWTPayload & {
  userId?: string;
  companyId?: string;
  role?: string;
  email?: string;
  subExp?: number;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Exact-match only — NEVER startsWith. A prefix check here would let
  // `/api/auth/login/evil` or `/signupx` bypass auth if such routes ever existed.
  const isPublicPage = publicPaths.includes(pathname);
  if (isPublicPage) return NextResponse.next();

  const isPublicApi = publicApiPaths.includes(pathname);
  if (isPublicApi) return NextResponse.next();

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let claims: TokenClaims;
  try {
    const verified = await jwtVerify(token, JWT_SECRET, { algorithms: [...JWT_ALGS] });
    claims = verified.payload as TokenClaims;
  } catch {
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Token expired or invalid' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('auth_token', '', { path: '/', maxAge: 0 });
    return response;
  }

  // Subscription gate — only if token carries subExp claim.
  // Legacy tokens without it skip this check and still work; new tokens enforce it.
  if (typeof claims.subExp === 'number' && claims.subExp < Date.now()) {
    const exempt = subscriptionExemptApis.includes(pathname);
    if (!exempt) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'subscription_expired' },
          { status: 402 }
        );
      }
      return NextResponse.redirect(
        new URL('/login?error=subscription_expired', request.url)
      );
    }
  }

  // Role-based path gate.
  // /superadmin/* → superadmin ONLY (never admin)
  // /admin/*      → admin + superadmin
  // /team/*       → role === 'user' only
  // /api/superadmin/* → superadmin ONLY
  // Wrong role → redirect to the correct dashboard.
  const role = claims.role;
  const isSuperAdmin = role === 'superadmin';
  const isAdminRole = role === 'admin' || role === 'superadmin';
  const isTeamRole = role === 'user';

  // Defensive: if the token has no recognizable role (legacy token, forgery,
  // or DB role drifted from JWT enum), DON'T bounce between /admin and /team
  // — that creates an infinite redirect loop. Treat as invalid token.
  if (
    !isAdminRole &&
    !isTeamRole &&
    (pathname.startsWith('/admin') || pathname.startsWith('/team') || pathname.startsWith('/superadmin'))
  ) {
    const response = NextResponse.redirect(
      new URL('/login?error=invalid_token', request.url)
    );
    response.cookies.set('auth_token', '', { path: '/', maxAge: 0 });
    return response;
  }

  // /superadmin gate — deny non-superadmin BEFORE the generic /admin check
  // so an admin can't sneak in via /superadmin/anything.
  if (pathname === '/superadmin' || pathname.startsWith('/superadmin/')) {
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }
  if (pathname.startsWith('/api/superadmin/')) {
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Use trailing slash to avoid catching `/admin-foo` or `/teamwork`.
  if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !isAdminRole) {
    return NextResponse.redirect(new URL('/team/dashboard', request.url));
  }
  if ((pathname === '/team' || pathname.startsWith('/team/')) && !isTeamRole) {
    const target = isSuperAdmin ? '/superadmin' : '/admin/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
