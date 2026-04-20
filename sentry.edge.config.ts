import * as Sentry from '@sentry/nextjs';

/**
 * Edge runtime Sentry init — for middleware.ts and any route exporting
 * `runtime: 'edge'`. Most of our auth runs on Node, but middleware.ts
 * is Edge by default.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
