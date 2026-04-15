import { LRUCache } from 'lru-cache';
import { NextResponse, type NextRequest } from 'next/server';

type Options = {
  /** Window in minutes */
  interval: number;
  /** Max distinct keys tracked in memory */
  uniqueTokenPerInterval: number;
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  /** Seconds until the oldest hit in the window falls off. Use for Retry-After. */
  retryAfter: number;
};

/**
 * Simple in-memory sliding-window limiter.
 *
 * ⚠️ Per serverless-instance only. On Vercel with scaling, an attacker
 * hitting N instances multiplies the effective budget. Swap to Upstash
 * Redis for fleet-wide limits (same interface, same call sites).
 */
export default function Ratelimit(options: Options) {
  const windowMs = options.interval * 60 * 1000;
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval,
    ttl: windowMs,
  });

  return {
    check: async (limit: number, token: string): Promise<RateLimitResult> => {
      const now = Date.now();
      const windowStart = now - windowMs;
      const hits = (tokenCache.get(token) || []).filter((t) => t > windowStart);

      if (hits.length >= limit) {
        const oldest = hits[0]!;
        const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return { success: false, remaining: 0, retryAfter };
      }

      tokenCache.set(token, [...hits, now]);
      return {
        success: true,
        remaining: limit - hits.length - 1,
        retryAfter: 0,
      };
    },
  };
}

// ==================== PRESETS ====================

/** Auth endpoints: 10 req / 10 min per key */
export const authLimiter = Ratelimit({ interval: 10, uniqueTokenPerInterval: 5000 });

/** OTP send: 3 sends / 15 min per phone or email (SMS-pumping defense) */
export const otpLimiter = Ratelimit({ interval: 15, uniqueTokenPerInterval: 5000 });

/** Password reset: 3 / hour per email */
export const resetLimiter = Ratelimit({ interval: 60, uniqueTokenPerInterval: 5000 });

// ==================== HELPERS ====================

/**
 * Build a ready-to-send 429 response with a correct `Retry-After` header.
 *
 * @param message  User-facing error string.
 * @param retryAfter  Seconds until the caller should retry.
 */
export function rateLimited(message: string, retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: message, retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfter)),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

/**
 * Extract the real client IP on Vercel.
 *
 * Vercel's edge always sets `x-real-ip` to the trusted client IP, and
 * appends the client IP to the RIGHT side of `x-forwarded-for`. Reading
 * the leftmost entry of a user-supplied x-forwarded-for header lets an
 * attacker spoof their IP by prepending arbitrary values — do not do that.
 */
export function getClientIp(req: NextRequest): string {
  const real = req.headers.get('x-real-ip');
  if (real && real.trim()) return real.trim();

  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return 'unknown';
}
