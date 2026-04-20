import * as Sentry from '@sentry/nextjs';

/**
 * Client-side (browser) Sentry init. Captures unhandled JS errors,
 * unhandled promise rejections, and React render errors via
 * `app/error.tsx` + `app/global-error.tsx` boundaries.
 *
 * Uses NEXT_PUBLIC_SENTRY_DSN because Next.js only exposes
 * NEXT_PUBLIC_* env vars to the browser bundle.
 */

// Required by Sentry to instrument client-side router navigations.
// Without this export, Sentry can't attach traces to page transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    tracesSampleRate: 0.1,
    sendDefaultPii: false,

    // Replay sessions on errors (10% of normal sessions, 100% of errored).
    // Comment these two out if you don't want session replay (extra cost).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
    ],

    beforeSend(event) {
      // Strip query string secrets if any leak into URLs
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          for (const key of ['token', 'otp', 'password']) {
            if (u.searchParams.has(key)) u.searchParams.set(key, '[REDACTED]');
          }
          event.request.url = u.toString();
        } catch {}
      }
      return event;
    },
  });
}
