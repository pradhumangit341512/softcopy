'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — the last line of defense.
 *
 * Runs when the ROOT layout itself throws (e.g. ThemeProvider error,
 * providers tree error, catastrophic client runtime failure). Because it
 * replaces the root layout, it MUST define its own <html> and <body>.
 *
 * Keep this file intentionally minimal: no custom providers, no shared
 * components, no Tailwind-dependent styles that might be the cause of
 * the crash. Inline styles only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: 'fatal',
        type: 'global_error_boundary',
        digest: error.digest ?? null,
        message: error.message,
        stack: error.stack,
        ts: new Date().toISOString(),
      })
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          color: '#111827',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '28rem',
            width: '100%',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
            Application error
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
            A critical error occurred and we couldn&apos;t render the page.
            Please try again in a moment.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '12px',
                color: '#9ca3af',
                fontFamily: 'monospace',
                margin: '0 0 24px',
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              appearance: 'none',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
