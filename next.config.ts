import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// ==================== SECURITY HEADERS ====================

/**
 * Content Security Policy.
 *
 * Tailwind + Next.js both need inline styles at runtime:
 *   - Tailwind v4 injects CSS vars inline at build
 *   - next/font/google emits inline @font-face declarations
 * so `'unsafe-inline'` on styles is unavoidable without nonces.
 *
 * `next/font/google` also self-hosts the woff2 files — they load from
 * /_next/static/media/, covered by `'self'`. No need to allow
 * fonts.gstatic.com. fonts.googleapis.com is allowed for the rare case
 * where a dev manually links a Google stylesheet.
 *
 * `'unsafe-eval'` is required for Next.js dev HMR and Razorpay's SDK.
 */
const isDev = process.env.NODE_ENV !== "production";

const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-eval' is required by Next.js HMR in dev. Razorpay's checkout
  // SDK runs inside an iframe at checkout.razorpay.com, NOT on our origin,
  // so it doesn't need eval here. Strip it in prod.
  isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.googletagmanager.com`
    : `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://*.upstash.io https://api.resend.com https://fonts.googleapis.com https://fonts.gstatic.com https://www.google-analytics.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Only upgrade insecure requests in production — localhost HTTP breaks otherwise.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Merged — single Permissions-Policy header. Previously we had two, the
  // second was silently overriding the first.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.7",
    "10.143.136.252",
    "localhost",
    "127.0.0.1",
  ],
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Sentry wraps the config to enable build-time source map upload + runtime
// instrumentation. When SENTRY_DSN is missing, Sentry init in
// sentry.*.config.ts is a no-op so this is safe locally.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,            // suppress build-time CLI noise locally
  tunnelRoute: "/monitoring",         // proxies Sentry events through your domain to dodge ad-blockers
  authToken: process.env.SENTRY_AUTH_TOKEN, // for source-map upload in CI; safe to skip
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN, // only upload when auth token is configured
  },
  // Sentry-specific webpack tuning — replaces the deprecated flat options.
  webpack: {
    treeshake: {
      removeDebugLogging: true, // strip Sentry's own debug logger from prod bundles
    },
    reactComponentAnnotation: { enabled: false }, // no automatic component name attribution
  },
});
