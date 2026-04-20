import * as Sentry from '@sentry/nextjs';

/**
 * Server-side Sentry init. Captures uncaught exceptions, unhandled
 * promise rejections, and any explicit Sentry.captureException() calls
 * from API route handlers.
 *
 * Skipped silently when SENTRY_DSN is unset so local dev doesn't error.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

    // Capture 10% of transactions for performance monitoring.
    // Bump to 1.0 if you want 100%, but you'll burn quota fast.
    tracesSampleRate: 0.1,

    // Don't send PII by default — explicit allow only.
    sendDefaultPii: false,

    // Filter spam errors that aren't actionable.
    ignoreErrors: [
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      // Browser extension noise — these reach the server when SSR is involved
      'top.GLOBALS',
      'ChunkLoadError',
    ],

    beforeSend(event) {
      // Strip cookies from request data — we never want them in Sentry.
      if (event.request?.cookies) {
        event.request.cookies = {} as typeof event.request.cookies;
      }
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        delete h.cookie;
        delete h.authorization;
      }
      return event;
    },
  });
}
