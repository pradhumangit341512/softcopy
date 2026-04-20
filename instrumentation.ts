/**
 * Next.js instrumentation file (Next 13+).
 *
 * Required by Sentry to initialize the SDK in the right runtime context.
 * Next calls `register()` exactly once when the server starts; we then
 * dynamically import the correct Sentry config for whichever runtime
 * Next has spawned (`nodejs` or `edge`).
 *
 * Browser/client init lives in `instrumentation-client.ts` (auto-loaded
 * by Next, no manual hookup needed).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Forwards request errors thrown during a Server Component render or a
 * Route Handler to Sentry. Without this, those errors only appear in
 * Vercel logs — never in Sentry.
 *
 * Re-exported as `onRequestError` (the name Next.js looks for).
 */
export { captureRequestError as onRequestError } from '@sentry/nextjs';
