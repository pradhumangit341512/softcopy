'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Route-segment error boundary. Next.js renders this when a client-side
 * render or data-fetch inside an App Router segment throws.
 *
 * - Catches render errors, effect errors, and uncaught promise rejections
 *   inside server components and client components.
 * - Offers a "Try again" action that re-invokes the segment's loader.
 * - Logs the digest (stable server-side hash) so the error can be
 *   correlated with server logs without leaking the full trace to the user.
 *
 * Do NOT render raw `error.message` to users in production — it may include
 * stack traces, DB paths, or internal identifiers.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry is wired in sentry.client.config.ts — exceptions thrown
    // during render are auto-captured. We also log a structured record so
    // it surfaces in Vercel logs even when Sentry is unavailable.
    try {
      console.error(
        JSON.stringify({
          level: 'error',
          type: 'route_error_boundary',
          digest: error.digest ?? null,
          message: error.message,
          stack: error.stack,
          ts: new Date().toISOString(),
        })
      );
    } catch {
      // JSON.stringify can throw on circular refs — fall back to plain log
      // so we never lose the original error.
      console.error('[error_boundary]', error);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          An unexpected error occurred while loading this page. The engineering
          team has been notified. You can retry, or head back to the homepage.
        </p>

        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">
            Reference: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg
              bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            <RefreshCw size={16} />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg
              border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
          >
            <Home size={16} />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
