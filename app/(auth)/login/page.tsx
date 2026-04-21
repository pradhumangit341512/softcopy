'use client';

/**
 * Option-A login UI: email + password first. OTP step only appears if the
 * server tells us it's needed (new device OR admin-role always-on 2FA).
 *
 * Flow:
 *   1. User enters email + password → submits
 *   2. Server either:
 *      - Returns { message, user, redirectTo } → we redirect ✓
 *      - Returns { requireOTP: true, reason } → we reveal the OTP input
 *   3. If OTP step, user types code + submits → same endpoint, now with `otp`
 *   4. Server returns { message, user, redirectTo } → we redirect
 */

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';

import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/common/Toast';
import { Alert } from '@/components/common/Alert';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { api, ApiError } from '@/lib/fetch';

type LoginResponse =
  | { message: string; user: unknown; redirectTo: string }
  | { requireOTP: true; message: string; reason?: 'new-device' | 'admin-2fa' | 'mandatory-otp' };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { setUser } = useAuthStore();

  // Flags from redirect URL
  const urlError = searchParams.get('error');
  const justVerified = searchParams.get('verified') === '1';
  const verificationFailed = searchParams.get('verified') === '0';

  // Check if user was kicked by another login
  const [sessionReplaced, setSessionReplaced] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('session_replaced') === '1') {
      setSessionReplaced(true);
      sessionStorage.removeItem('session_replaced');
    }
  }, []);

  const initialError =
    urlError === 'subscription_expired' ? 'Your subscription has expired. Please renew to continue.' :
    urlError === 'session_expired'      ? 'Your session expired. Please sign in again.' :
    verificationFailed                   ? 'That verification link is invalid or has expired. Please sign up again.' :
                                           '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpReason, setOtpReason] = useState<'new-device' | 'admin-2fa' | 'mandatory-otp' | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; otp?: string }>({});
  const [formError, setFormError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const startCountdown = (seconds = 60) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setResendCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setResendCountdown((n) => {
        if (n <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  const applyApiError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      if (err.fields) {
        const e: typeof fieldErrors = {};
        if (err.fields.email) e.email = err.fields.email;
        if (err.fields.password) e.password = err.fields.password;
        if (err.fields.otp) e.otp = err.fields.otp;
        setFieldErrors(e);
      }
      setFormError(err.message || fallback);
    } else {
      setFormError(fallback);
    }
  };

  const validate = (): boolean => {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Please enter a valid email';
    if (!password) errs.password = 'Password is required';
    if (otpReason && (!otp || otp.length !== 6)) errs.otp = 'Enter the 6-digit code';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post<LoginResponse>('/api/auth/login', {
        email: email.trim(),
        password,
        ...(otp ? { otp } : {}),
      });

      if ('requireOTP' in res) {
        // Server says this device needs an OTP step.
        setOtpReason(res.reason ?? 'new-device');
        setOtp('');
        setFieldErrors((p) => ({ ...p, otp: undefined }));
        startCountdown(60);
        addToast({ type: 'info', message: res.message });
      } else {
        // Full login returned.
        setUser(res.user as Parameters<typeof setUser>[0]);
        addToast({ type: 'success', message: 'Welcome back!' });
        // Validate redirectTo is a same-origin absolute path. Defense
        // against future server bug returning a user-controlled URL.
        const isSafeRedirect =
          typeof res.redirectTo === 'string' &&
          res.redirectTo.startsWith('/') &&
          !res.redirectTo.startsWith('//') &&
          !res.redirectTo.startsWith('/\\');
        window.location.href = isSafeRedirect ? res.redirectTo : '/dashboard';
      }
    } catch (err) {
      applyApiError(err, 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || loading) return;
    setFormError('');
    setOtp('');
    setLoading(true);
    try {
      // Submitting without otp to the same endpoint triggers a new send.
      const res = await api.post<LoginResponse>('/api/auth/login', {
        email: email.trim(),
        password,
      });
      if ('requireOTP' in res) {
        startCountdown(60);
        addToast({ type: 'success', message: 'A new code has been sent.' });
      }
    } catch (err) {
      applyApiError(err, 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
        {otpReason ? 'One more step' : 'Welcome back'}
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        {otpReason
          ? `We sent a 6-digit code to ${email}. Enter it below to sign in.`
          : 'Sign in to your BrokerCRM account'}
      </p>

      {sessionReplaced && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Signed out — another device logged in
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Your account was accessed from another device. Only one active session is allowed.
              If this wasn&apos;t you, change your password immediately after signing in.
            </p>
          </div>
        </div>
      )}

      {justVerified && (
        <Alert
          type="success"
          title="Email verified"
          message="Your email has been confirmed. You can sign in now."
        />
      )}

      {formError && (
        <Alert
          type="error"
          title="Error"
          message={formError}
          closeable
          onClose={() => setFormError('')}
        />
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input
          label="Email Address"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldErrors((p) => ({ ...p, email: undefined }));
          }}
          disabled={!!otpReason || loading}
          error={fieldErrors.email}
          icon={<Mail size={18} />}
          className="text-black"
          autoComplete="email"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              disabled={!!otpReason || loading}
              placeholder="Enter your password"
              className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-black
                disabled:bg-gray-50 disabled:text-gray-500"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={!!otpReason || loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-sm text-red-500">{fieldErrors.password}</p>
          )}
        </div>

        {otpReason && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
              <ShieldCheck size={18} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                A verification code is required on every sign-in to keep your account secure.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ''));
                  setFieldErrors((p) => ({ ...p, otp: undefined }));
                }}
                placeholder="000000"
                className="w-full px-3 sm:px-4 py-3 text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em]
                  text-center border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:border-blue-400 font-mono text-black"
                autoFocus
                autoComplete="one-time-code"
              />
              {fieldErrors.otp && <p className="mt-1 text-sm text-red-500">{fieldErrors.otp}</p>}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {resendCountdown > 0
                  ? <>Resend in <span className="font-semibold text-red-500">{resendCountdown}s</span></>
                  : "Didn't get it?"}
              </span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCountdown > 0 || loading}
                className="text-blue-600 font-semibold hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2"
          loading={loading}
          disabled={otpReason !== null && otp.length !== 6}
        >
          {otpReason ? <>Verify & Sign In <CheckCircle size={18} /></> : <>Sign in <ArrowRight size={18} /></>}
        </Button>

        {otpReason && (
          <button
            type="button"
            onClick={() => {
              setOtpReason(null);
              setOtp('');
              setFieldErrors({});
              setFormError('');
            }}
            disabled={loading}
            className="w-full text-sm text-gray-500 hover:text-gray-700 text-center disabled:opacity-50"
          >
            ← Use a different account
          </button>
        )}

        {!otpReason && (
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
              Forgot password?
            </Link>
          </div>
        )}
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-sm text-gray-400">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <p className="text-center text-gray-600 text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/#contact" className="text-blue-600 font-semibold hover:text-blue-700">
          Request access
        </Link>
      </p>
    </div>
  );
}
