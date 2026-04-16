import { z } from 'zod';

/**
 * Environment schema. Imported at module load by `lib/db.ts` so any missing
 * / malformed env fails the build (or first request) rather than silently
 * running with empty strings.
 *
 * Group 1 (REQUIRED): app will refuse to start without them.
 * Group 2 (FEATURE): only validated if the related feature is enabled.
 */
const schema = z.object({
  // ---- Runtime ----
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ---- REQUIRED ----
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),

  // Base URL used to build absolute links in emails (verification, reset).
  // Defaults to http://localhost:3000 in dev. In prod, set to your domain.
  APP_URL: z.string().url().default('http://localhost:3000'),

  // ---- RECOMMENDED ----
  OTP_PEPPER: z
    .string()
    .min(16, 'OTP_PEPPER must be at least 16 characters')
    .optional(),

  // ---- Optional feature flags ----
  BYPASS_AUTH: z.enum(['true', 'false']).optional(),

  // ---- Vercel markers (set by the platform — never by you) ----
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),

  // ---- Email (Resend) ----
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  // ---- SMS (Twilio) ----
  // Format validation happens at the Twilio call site (route checks startsWith('AC')).
  // Keeping the schema loose here so placeholder values in .env.local don't fail the build.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // ---- Payments (Razorpay) ----
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // ---- Rate limiting (Upstash Redis) ----
  // Required in production. Optional locally — falls back to in-memory.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(20).optional(),

  // ---- Error tracking (Sentry) ----
  // SENTRY_DSN — server-side. NEXT_PUBLIC_SENTRY_DSN — browser-side (must
  // duplicate the value because Next only inlines NEXT_PUBLIC_* in client bundles).
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // ---- Cron auth ----
  CRON_SECRET: z.string().min(16).optional(),
});

type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // Throw loudly and early — never let the app boot into an insecure state.
    throw new Error(
      `FATAL: Invalid environment variables:\n${formatted}\n\nSee lib/env.ts for the schema.`
    );
  }

  // Safety guard: BYPASS_AUTH=true must NEVER be set in a deployed production
  // or preview environment. We allow it during `next build` (which runs with
  // NODE_ENV=production on the developer's machine) because the bypass logic
  // itself is gated on `!process.env.VERCEL && !process.env.VERCEL_ENV` too.
  const isDeployedProd =
    parsed.data.VERCEL_ENV === 'production' ||
    parsed.data.VERCEL_ENV === 'preview';
  if (parsed.data.BYPASS_AUTH === 'true' && isDeployedProd) {
    throw new Error(
      'FATAL: BYPASS_AUTH=true is forbidden in production/preview environments.'
    );
  }

  return parsed.data;
}

export const env: Env = loadEnv();
