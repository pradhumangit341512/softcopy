import { NextResponse } from 'next/server';

/**
 * Stable error codes — DO NOT change the string values after they're shipped.
 * Frontend code, mobile apps, API clients, and analytics may depend on them.
 *
 * Convention:
 *   - UPPER_SNAKE_CASE
 *   - Prefix by domain: AUTH_*, OTP_*, PAY_*, VALIDATION_*, RATE_*, SYSTEM_*
 *   - The human-readable message is separate — safe to iterate on freely.
 */
export const ErrorCode = {
  // ---- Auth / session ----
  AUTH_UNAUTHORIZED:      'AUTH_UNAUTHORIZED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED:     'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID:     'AUTH_TOKEN_INVALID',
  AUTH_ACCOUNT_INACTIVE:  'AUTH_ACCOUNT_INACTIVE',
  AUTH_FORBIDDEN:         'AUTH_FORBIDDEN',
  AUTH_SUBSCRIPTION_EXPIRED: 'AUTH_SUBSCRIPTION_EXPIRED',

  // ---- OTP ----
  OTP_REQUIRED:           'OTP_REQUIRED',
  OTP_INVALID:            'OTP_INVALID',
  OTP_EXPIRED:            'OTP_EXPIRED',
  OTP_LOCKED:             'OTP_LOCKED',
  OTP_NOT_FOUND:          'OTP_NOT_FOUND',
  OTP_SEND_FAILED:        'OTP_SEND_FAILED',

  // ---- Validation ----
  VALIDATION_FAILED:      'VALIDATION_FAILED',
  VALIDATION_INVALID_JSON: 'VALIDATION_INVALID_JSON',

  // ---- Rate limiting ----
  RATE_LIMITED:           'RATE_LIMITED',

  // ---- Resource / domain ----
  RESOURCE_NOT_FOUND:     'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT:      'RESOURCE_CONFLICT',
  RESOURCE_FORBIDDEN:     'RESOURCE_FORBIDDEN',

  // ---- Payment ----
  PAYMENT_CONFIG_MISSING: 'PAYMENT_CONFIG_MISSING',
  PAYMENT_INVALID_PLAN:   'PAYMENT_INVALID_PLAN',

  // ---- Server / infra ----
  SYSTEM_INTERNAL_ERROR:  'SYSTEM_INTERNAL_ERROR',
  SYSTEM_CONFIG_MISSING:  'SYSTEM_CONFIG_MISSING',
  SYSTEM_UPSTREAM_FAILURE: 'SYSTEM_UPSTREAM_FAILURE',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

// ==================== SHAPE ====================

export interface ApiErrorBody {
  /** Stable error code — safe for frontend/i18n to switch on. */
  code: ErrorCodeValue;
  /** Human-readable message — may change without notice. */
  error: string;
  /** Optional per-field validation errors, keyed by Zod path. */
  fields?: Record<string, string>;
  /** Optional root-level validation errors (non-field issues). */
  root?: string[];
  /** When to retry, in seconds. Present on 429 responses. */
  retryAfter?: number;
  /** Stable reference for correlating with server logs. */
  requestId?: string;
}

// ==================== BUILDERS ====================

/**
 * Build a JSON error response with a consistent shape + correct status code.
 * Always sets `Content-Type: application/json` and, where relevant,
 * `Retry-After` + `X-Request-Id` headers so observability tooling can correlate.
 */
export function apiError(
  code: ErrorCodeValue,
  message: string,
  options: {
    status?: number;
    fields?: Record<string, string>;
    root?: string[];
    retryAfter?: number;
    requestId?: string;
    headers?: Record<string, string>;
  } = {}
): NextResponse<ApiErrorBody> {
  const status = options.status ?? statusForCode(code);
  const body: ApiErrorBody = {
    code,
    error: message,
    ...(options.fields ? { fields: options.fields } : {}),
    ...(options.root?.length ? { root: options.root } : {}),
    ...(options.retryAfter ? { retryAfter: options.retryAfter } : {}),
    ...(options.requestId ? { requestId: options.requestId } : {}),
  };

  const headers: Record<string, string> = { ...options.headers };
  if (options.retryAfter) headers['Retry-After'] = String(Math.max(1, options.retryAfter));
  if (options.requestId) headers['X-Request-Id'] = options.requestId;

  return NextResponse.json(body, { status, headers });
}

/**
 * Sensible default HTTP status per error code. Callers can override via
 * `apiError(code, msg, { status })` when the context demands a different one.
 */
function statusForCode(code: ErrorCodeValue): number {
  switch (code) {
    case ErrorCode.AUTH_UNAUTHORIZED:
    case ErrorCode.AUTH_INVALID_CREDENTIALS:
    case ErrorCode.AUTH_TOKEN_EXPIRED:
    case ErrorCode.AUTH_TOKEN_INVALID:
      return 401;

    case ErrorCode.AUTH_ACCOUNT_INACTIVE:
    case ErrorCode.AUTH_FORBIDDEN:
    case ErrorCode.RESOURCE_FORBIDDEN:
      return 403;

    case ErrorCode.AUTH_SUBSCRIPTION_EXPIRED:
      return 402;

    case ErrorCode.RESOURCE_NOT_FOUND:
    case ErrorCode.OTP_NOT_FOUND:
      return 404;

    case ErrorCode.RESOURCE_CONFLICT:
      return 409;

    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.VALIDATION_INVALID_JSON:
    case ErrorCode.OTP_INVALID:
    case ErrorCode.OTP_EXPIRED:
    case ErrorCode.OTP_REQUIRED:
    case ErrorCode.PAYMENT_INVALID_PLAN:
      return 400;

    case ErrorCode.RATE_LIMITED:
    case ErrorCode.OTP_LOCKED:
      return 429;

    case ErrorCode.PAYMENT_CONFIG_MISSING:
    case ErrorCode.SYSTEM_CONFIG_MISSING:
    case ErrorCode.SYSTEM_UPSTREAM_FAILURE:
    case ErrorCode.SYSTEM_INTERNAL_ERROR:
    case ErrorCode.OTP_SEND_FAILED:
    default:
      return 500;
  }
}

// ==================== REQUEST-ID ====================

/** Short correlation ID attached to every response so logs + users align. */
export function newRequestId(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}
