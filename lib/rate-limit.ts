import { NextResponse, type NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { LRUCache } from 'lru-cache';

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  /** Seconds until the window resets — used for Retry-After header. */
  retryAfter: number;
};

export interface Limiter {
  check(limit: number, token: string): Promise<RateLimitResult>;
}

// ==================== UPSTASH REDIS CLIENT ====================

const HAS_UPSTASH =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const IS_PROD =
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL_ENV === 'preview';

if (!HAS_UPSTASH && IS_PROD) {
  throw new Error(
    'FATAL: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.'
  );
}

const redis = HAS_UPSTASH
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// ==================== SLIDING-WINDOW FACTORY ====================

/**
 * Upstash's Ratelimit locks limit + window at construction. Our call sites
 * pass different limits per preset (e.g. authLimiter.check(20, ...) vs .check(10, ...)),
 * so we lazily cache one Ratelimit per (preset, limit) pair.
 */
type Preset = {
  /** Upstash duration string, e.g. '10 m', '15 m', '60 m' */
  window: `${number} ${'s' | 'm' | 'h'}`;
  prefix: string;
};

const instanceCache = new Map<string, Ratelimit>();

function upstashLimiter(preset: Preset, limit: number): Ratelimit {
  const cacheKey = `${preset.prefix}:${limit}`;
  let inst = instanceCache.get(cacheKey);
  if (!inst) {
    inst = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, preset.window),
      prefix: `cms:${preset.prefix}`,
      analytics: true, // tracked in Upstash dashboard
    });
    instanceCache.set(cacheKey, inst);
  }
  return inst;
}

// ==================== DEV FALLBACK (in-memory) ====================

/**
 * Used ONLY when Upstash env vars are missing in dev. Preserves API so
 * `npm run dev` works without an Upstash account. Never reached in prod.
 */
function memoryLimiter(preset: Preset): Limiter {
  const windowMinutes = Number(preset.window.split(' ')[0]);
  const windowMs = windowMinutes * 60 * 1000;
  const cache = new LRUCache<string, number[]>({ max: 5000, ttl: windowMs });

  return {
    check: async (limit, token) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      const hits = (cache.get(token) || []).filter((t) => t > windowStart);

      if (hits.length >= limit) {
        const oldest = hits[0]!;
        const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return { success: false, remaining: 0, retryAfter };
      }
      cache.set(token, [...hits, now]);
      return { success: true, remaining: limit - hits.length - 1, retryAfter: 0 };
    },
  };
}

// ==================== LIMITER FACTORY ====================

function makeLimiter(preset: Preset): Limiter {
  if (!redis) {
    if (IS_PROD) {
      // Should never happen — env.ts already throws. But belt-and-suspenders.
      throw new Error('Upstash misconfigured in production');
    }
    // Dev only — log once, fall back to in-memory.
    if (!hasWarnedNoUpstash) {
      hasWarnedNoUpstash = true;

      console.warn('[rate-limit] No Upstash configured — using in-memory fallback (dev only).');
    }
    return memoryLimiter(preset);
  }

  return {
    check: async (limit, token) => {
      const r = await upstashLimiter(preset, limit).limit(token);
      const retryAfter = r.success ? 0 : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
      return { success: r.success, remaining: r.remaining, retryAfter };
    },
  };
}

let hasWarnedNoUpstash = false;

// ==================== PRESETS ====================

/** Auth endpoints — N req / 10 min per key */
export const authLimiter: Limiter = makeLimiter({ window: '10 m', prefix: 'auth' });

/** OTP send/verify — N req / 15 min per phone or email */
export const otpLimiter: Limiter = makeLimiter({ window: '15 m', prefix: 'otp' });

/** Password reset — N req / hour per email or IP */
export const resetLimiter: Limiter = makeLimiter({ window: '60 m', prefix: 'reset' });

/** Generic per-user API limiter — for /api/auth/me + heavy endpoints */
export const apiLimiter: Limiter = makeLimiter({ window: '1 m', prefix: 'api' });

// ==================== HELPERS ====================

import { ErrorCode, apiError } from './errors';

/**
 * Build a 429 response with Retry-After + X-RateLimit-Remaining headers.
 * Uses the new apiError builder so the response shape carries `code: RATE_LIMITED`.
 */
export function rateLimited(message: string, retryAfter: number): NextResponse {
  return apiError(ErrorCode.RATE_LIMITED, message, {
    retryAfter,
    headers: { 'X-RateLimit-Remaining': '0' },
  });
}

/**
 * Best-effort client IP. Order:
 *   1. CF-Connecting-IP (Cloudflare)
 *   2. RIGHTMOST entry of x-forwarded-for (Vercel appends true client IP)
 *   3. x-real-ip
 *   4. 'unknown' (better to apply a global bucket than skip)
 */
export function getClientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf?.trim()) return cf.trim();

  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  const real = req.headers.get('x-real-ip');
  if (real?.trim()) return real.trim();

  return 'unknown';
}
