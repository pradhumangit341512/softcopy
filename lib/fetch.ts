/**
 * `authFetch` — single entry point for every authenticated API call from the
 * browser. Handles:
 *
 *   - Sends cookies automatically (`credentials: 'include'`).
 *   - Enforces a timeout so a hung request doesn't lock the UI.
 *   - Surfaces structured server errors as a typed `ApiError` the caller
 *     can `instanceof`-check.
 *   - On 401 from a non-auth endpoint, triggers a single redirect to
 *     /login with a `?redirect=` param so the user returns to where
 *     they were. Avoids the double-redirect trap of every component
 *     doing its own 401 handling.
 *   - On 402 (subscription_expired), redirects to
 *     /login?error=subscription_expired.
 *
 * Every React data-fetch / mutation in the app should go through this,
 * NOT raw `fetch()`. One place to add retries, tracing, auth refresh, etc.
 */

import type { ApiErrorBody, ErrorCodeValue } from './errors';

const DEFAULT_TIMEOUT_MS = 15_000;
const AUTH_ENDPOINTS = ['/api/auth/'];

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue | null;
  readonly fields?: Record<string, string>;
  readonly root?: string[];
  readonly retryAfter?: number;
  readonly requestId?: string;

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.error || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = (body.code as ErrorCodeValue) ?? null;
    this.fields = body.fields;
    this.root = body.root;
    this.retryAfter = body.retryAfter;
    this.requestId = body.requestId;
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export interface AuthFetchOptions extends RequestInit {
  /** Max time before the request is aborted. Default 15s. */
  timeoutMs?: number;
  /** Skip the auto-redirect on 401. Useful for login itself. */
  skipAuthRedirect?: boolean;
}

// ==================== REDIRECT LATCH ====================

// Prevent concurrent requests from firing 5 login redirects at once.
let isRedirecting = false;

function redirectToLogin(reason: 'session_expired' | 'subscription_expired') {
  if (isRedirecting) return;
  if (typeof window === 'undefined') return;
  isRedirecting = true;
  const current = window.location.pathname + window.location.search;
  const params = new URLSearchParams();
  params.set('error', reason);
  if (current && current !== '/login') params.set('redirect', current);
  window.location.href = `/login?${params.toString()}`;
}

// ==================== CORE ====================

export async function authFetch<T = unknown>(
  input: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuthRedirect = false,
    headers: customHeaders,
    ...rest
  } = options;

  // Compose headers. Only set Content-Type when sending a JSON body —
  // omitting it for GET lets the browser negotiate.
  const headers = new Headers(customHeaders);
  // Only auto-set application/json for stringified bodies. FormData / Blob /
  // URLSearchParams need the browser to set Content-Type with the right
  // boundary or encoding.
  if (typeof rest.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(input, {
      ...rest,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError(timeoutMs);
    }
    throw new NetworkError('Network request failed', err);
  } finally {
    clearTimeout(timeout);
  }

  // Happy path
  if (response.ok) {
    // No body (204) → return undefined cast to T.
    if (response.status === 204) return undefined as T;
    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      return (await response.json()) as T;
    }
    // Non-JSON (e.g. file download) — caller handles via direct fetch.
    return (await response.text()) as unknown as T;
  }

  // Error path — parse body if JSON, else synthesize
  let body: Partial<ApiErrorBody> = {};
  try {
    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      body = (await response.json()) as Partial<ApiErrorBody>;
    } else {
      const text = await response.text();
      body = { error: text || `Request failed (${response.status})` };
    }
  } catch {
    body = { error: `Request failed (${response.status})` };
  }

  // Auto-redirect on session / subscription errors.
  const isAuthRequest = AUTH_ENDPOINTS.some((p) => input.startsWith(p));
  if (!skipAuthRedirect && !isAuthRequest) {
    if (response.status === 401) {
      redirectToLogin('session_expired');
    } else if (response.status === 402) {
      redirectToLogin('subscription_expired');
    }
  }

  throw new ApiError(response.status, body);
}

// ==================== CONVENIENCE WRAPPERS ====================

export const api = {
  get:  <T>(url: string, opts?: AuthFetchOptions) =>
    authFetch<T>(url, { ...opts, method: 'GET' }),

  post: <T>(url: string, body?: unknown, opts?: AuthFetchOptions) =>
    authFetch<T>(url, {
      ...opts,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(url: string, body?: unknown, opts?: AuthFetchOptions) =>
    authFetch<T>(url, {
      ...opts,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  del: <T>(url: string, opts?: AuthFetchOptions) =>
    authFetch<T>(url, { ...opts, method: 'DELETE' }),
};
