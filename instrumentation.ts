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
 *
 * The dynamic imports are wrapped in try/catch because `.next` cache
 * corruption — usually a webpack chunk getting evicted mid-HMR — can
 * leave the runtime-specific bundle missing on disk while `register()`
 * still fires. Without this guard, a missing chunk takes down every
 * request with `ENOENT: edge-instrumentation.js`. Skipping init means
 * we lose Sentry telemetry until the next clean boot, which is strictly
 * better than a fully unusable dev server.
 */
export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config');
    } else if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[instrumentation] Sentry init skipped:', err);
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
