'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/common/Toast';
import Alert from '@/components/common/Alert';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import Input from '@/components/common/ Input';
import Button from '@/components/common/ Button';

type Step = 'credentials' | 'otp';

export default function LoginPage() {
  const router       = useRouter();
  const { addToast } = useToast();
  const { setUser }  = useAuthStore();

  const [step, setStep]               = useState<Step>('credentials');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [otp, setOtp]                 = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors]           = useState({ email: '', password: '', otp: '' });
  const [localError, setLocalError]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [countdown, setCountdown]     = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; return 0; }
        return p - 1;
      });
    }, 1000);
  };

  const validateCredentials = () => {
    const e = { email: '', password: '', otp: '' };
    let ok = true;
    if (!email) { e.email = 'Email is required'; ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { e.email = 'Invalid email'; ok = false; }
    if (!password) { e.password = 'Password is required'; ok = false; }
    setErrors(e);
    return ok;
  };

  // ── Step 1: Submit email+password → receive OTP ──
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!validateCredentials()) return;

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',   // ✅ needed for cookies
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLocalError(data.error || 'Login failed');
        // Still transition to OTP step if server says OTP is required (even on rate-limit)
        if (data.requireOTP && step !== 'otp') {
          setStep('otp');
          startCountdown();
        }
        return;
      }

      if (data.requireOTP) {
        setStep('otp');
        startCountdown();
        addToast({ type: 'success', message: data.message || 'OTP sent to your email!' });
      }
    } catch {
      setLocalError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Submit OTP → get JWT cookie + user ──
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!otp || otp.length !== 6) {
      setErrors(p => ({ ...p, otp: 'Enter the 6-digit OTP' }));
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',   // ✅ required to receive cookie
        body:        JSON.stringify({ email, password, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLocalError(data.error || 'Invalid OTP');
        return;
      }

      // ✅ Update store — sets isAuthenticated: true + hasFetched: true
      setUser(data.user);
      addToast({ type: 'success', message: 'Login successful!' });
      router.replace('/dashboard');
    } catch {
      setLocalError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    if (countdown > 0) return;
    setLocalError(''); setOtp(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/send-email-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, purpose: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) { setLocalError(data.error || 'Failed to resend'); return; }
      startCountdown();
      addToast({ type: 'success', message: 'New OTP sent!' });
    } catch {
      setLocalError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
          ${step === 'credentials' ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'}`}>
          {step === 'otp' ? '✓' : '1'}
        </div>
        <div className={`flex-1 h-1 rounded ${step === 'otp' ? 'bg-blue-600' : 'bg-gray-200'}`} />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
          ${step === 'otp' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          2
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 mb-1">
        {step === 'credentials' ? 'Welcome Back' : 'Verify Your Email'}
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        {step === 'credentials'
          ? 'Sign in to your BrokerCRM account'
          : `We sent a 6-digit code to ${email}`}
      </p>

      {localError && (
        <Alert type="error" title="Error" message={localError}
          closeable onClose={() => setLocalError('')} />
      )}

      {/* ══ STEP 1 ══ */}
      {step === 'credentials' && (
        <form onSubmit={handleCredentials} className="space-y-5">
          <Input
            label="Email Address" type="email" placeholder="john@example.com"
            className="text-black" value={email}
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
            error={errors.email} icon={<Mail size={18} />} required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                placeholder="Enter your password"
                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                required
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full flex items-center justify-center gap-2" loading={loading}>
            Continue <ArrowRight size={18} />
          </Button>
        </form>
      )}

      {/* ══ STEP 2 ══ */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOTP} className="space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <ShieldCheck size={20} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Check your inbox</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Sent to <strong>{email}</strong> — expires in 10 minutes.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter OTP <span className="text-red-500">*</span>
            </label>
            <input
              type="text" inputMode="numeric" maxLength={6} value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setErrors(p => ({ ...p, otp: '' })); }}
              placeholder="000000"
              className="w-full px-3 sm:px-4 py-3 sm:py-4 text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] text-center border-2
                border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-blue-400 font-mono text-black"
              autoFocus
            />
            {errors.otp && <p className="mt-1 text-sm text-red-500">{errors.otp}</p>}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {countdown > 0
                ? <>Resend in <span className="font-bold text-red-500">{countdown}s</span></>
                : "Didn't receive it?"}
            </span>
            <button type="button" onClick={handleResend}
              disabled={countdown > 0 || loading}
              className="text-blue-600 font-semibold hover:text-blue-700
                disabled:text-gray-400 disabled:cursor-not-allowed">
              Resend OTP
            </button>
          </div>

          <Button type="submit" className="w-full flex items-center justify-center gap-2"
            loading={loading} disabled={otp.length !== 6}>
            Verify & Sign In <ShieldCheck size={18} />
          </Button>

          <button type="button"
            onClick={() => { setStep('credentials'); setOtp(''); setLocalError(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
            ← Back to login
          </button>
        </form>
      )}

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-sm text-gray-400">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <p className="text-center text-gray-600 text-sm">
        Don't have an account?{' '}
        <Link href="/signup" className="text-blue-600 font-semibold hover:text-blue-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}