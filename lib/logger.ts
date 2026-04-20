/**
 * Structured logger with a Pino-compatible surface.
 *
 * Dev:  pretty multi-line output, one line per field.
 * Prod: single-line JSON on stdout — Vercel / Axiom / Datadog can parse it.
 *
 * Intentionally wraps `console` today so we have zero runtime dependencies
 * and work in Edge + Node + browser. Swap the implementation for actual
 * `pino` later without touching any call site.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId, route: '/api/auth/login' }, 'Login success');
 *   logger.warn({ ip, email }, 'Rate limit hit');
 *   logger.error({ err: error, requestId }, 'Signup failed');
 */

type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_RANK: Record<Level, number> = {
  debug: 10, info: 20, warn: 30, error: 40, fatal: 50,
};

const CURRENT_LEVEL: Level =
  (process.env.LOG_LEVEL as Level) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const IS_PROD = process.env.NODE_ENV === 'production';

type Bindings = Record<string, unknown>;

// ==================== SANITIZER ====================

/**
 * Redact obviously-sensitive fields before they ever reach stdout.
 * Belt-and-suspenders: callers should not pass secrets in the first place,
 * but a single mistake shouldn't leak tokens to a log aggregator forever.
 */
const REDACT_KEYS = new Set([
  'password', 'newpassword', 'confirmpassword',
  'otp', 'otphash', 'token', 'accesstoken', 'refreshtoken', 'jwt',
  'authorization', 'cookie', 'set-cookie',
  'apikey', 'secret', 'clientsecret',
  'razorpay_payment_id', 'razorpay_signature',
  // Session-related
  'session', 'sessionid', 'sessiontoken', 'csrftoken',
  'auth_token', 'x-api-key', 'x-auth-token', 'bearer',
  // Trusted device + verification tokens
  'tokenhash', 'rawtoken',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: IS_PROD ? undefined : value.stack,
    };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k) || REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

// ==================== EMIT ====================

function emit(level: Level, bindings: Bindings, message: string) {
  if (LEVEL_RANK[level] < LEVEL_RANK[CURRENT_LEVEL]) return;

  const safeBindings = redact(bindings) as Bindings;
  const record = {
    level,
    ts: new Date().toISOString(),
    msg: message,
    ...safeBindings,
  };

  // ── Forward errors to Sentry (server + edge runtime) ──
  // Wrapped in try/catch + dynamic require so a missing/broken Sentry never
  // brings down the request path.
  if (level === 'error' || level === 'fatal') {
    try {
      // Lazy require — avoids loading @sentry/nextjs in client bundle when
      // logger is imported there. Only runs server-side.
      if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/nextjs');
        const err = (bindings as { err?: unknown }).err;
        if (err instanceof Error) {
          Sentry.captureException(err, { extra: safeBindings, tags: { logger: 'pino' } });
        } else {
          Sentry.captureMessage(message, {
            level: level === 'fatal' ? 'fatal' : 'error',
            extra: safeBindings,
          });
        }
      }
    } catch {
      // Sentry not installed or failed — do not block the log path.
    }
  }

  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    // Circular ref → fall back to a safe representation
    line = JSON.stringify({ level, ts: record.ts, msg: message, _stringify_failed: true });
  }

  if (IS_PROD) {
    if (level === 'error' || level === 'fatal') {

      console.error(line);
    } else {

      console.log(line);
    }
    return;
  }

  // Dev: pretty colored output
  const prefix =
    level === 'error' || level === 'fatal' ? '\x1b[31m' :
    level === 'warn'                       ? '\x1b[33m' :
    level === 'info'                       ? '\x1b[36m' :
                                             '\x1b[90m';
  const fn = (level === 'error' || level === 'fatal') ? console.error : console.log;
  fn(`${prefix}[${level.toUpperCase()}]\x1b[0m ${message}`, bindings && Object.keys(bindings).length ? bindings : '');
}

// ==================== PUBLIC API ====================

export interface Logger {
  debug(bindings: Bindings, message: string): void;
  info(bindings: Bindings, message: string): void;
  warn(bindings: Bindings, message: string): void;
  error(bindings: Bindings, message: string): void;
  fatal(bindings: Bindings, message: string): void;
  /** Return a child logger with additional bindings attached to every log. */
  child(bindings: Bindings): Logger;
}

function makeLogger(base: Bindings = {}): Logger {
  return {
    debug: (b, m) => emit('debug', { ...base, ...b }, m),
    info:  (b, m) => emit('info',  { ...base, ...b }, m),
    warn:  (b, m) => emit('warn',  { ...base, ...b }, m),
    error: (b, m) => emit('error', { ...base, ...b }, m),
    fatal: (b, m) => emit('fatal', { ...base, ...b }, m),
    child: (b) => makeLogger({ ...base, ...b }),
  };
}

export const logger: Logger = makeLogger({ service: 'clientcms' });
