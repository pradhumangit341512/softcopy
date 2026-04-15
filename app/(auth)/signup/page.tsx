'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/common/Toast';
import { Alert } from '@/components/common/Alert';
import {
  User, Mail, Phone, Building2, Lock,
  Eye, EyeOff, ArrowRight, CheckCircle, ShieldCheck,
} from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

type Step = 'personal' | 'company' | 'otp';

export default function SignupPage() {
  const router       = useRouter();
  const { addToast } = useToast();
  // ✅ Use setUser instead of direct setState — keeps hasFetched in sync
  const { setUser }  = useAuthStore();

  const [step, setStep] = useState<Step>('personal');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', companyName: '', password: '', confirmPassword: '',
  });
  const [otp, setOtp]                             = useState('');
  const [showPassword, setShowPassword]           = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors]                       = useState<Record<string, string>>({});
  const [localError, setLocalError]               = useState('');
  const [agreeTerms, setAgreeTerms]               = useState(false);
  const [loading, setLoading]                     = useState(false);
  const [countdown, setCountdown]                 = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const update = (key: string, val: string) => {
    setFormData(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

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

  // ── Validate step 1 ──
  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Full name is required';
    if (!formData.email)       e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Invalid email';
    if (!formData.phone)       e.phone = 'Phone is required';
    else if (!/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s/g, '')))
      e.phone = 'Invalid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Validate step 2 ──
  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!formData.companyName.trim())  e.companyName = 'Company name is required';
    if (!formData.password)            e.password    = 'Password is required';
    else if (formData.password.length < 6) e.password = 'Min 6 characters';
    else if (!/[A-Z]/.test(formData.password)) e.password = 'Must contain uppercase';
    else if (!/[a-z]/.test(formData.password)) e.password = 'Must contain lowercase';
    else if (!/[0-9]/.test(formData.password)) e.password = 'Must contain a number';
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!agreeTerms) e.terms = 'You must agree to the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 2: send OTP ──
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/signup', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ ...formData }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setErrors(p => ({ ...p, email: data.error }));
        setStep('personal');
        return;
      }
      if (!res.ok) {
        setLocalError(data.error || 'Failed to send OTP');
        if (data.requireOTP && step !== 'otp') setStep('otp');
        return;
      }

      setStep('otp');
      startCountdown();
      addToast({ type: 'success', message: 'OTP sent to your email!' });
    } catch {
      setLocalError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: verify OTP → create account ──
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!otp || otp.length !== 6) {
      setErrors(p => ({ ...p, otp: 'Enter the 6-digit OTP' }));
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/signup', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',   // ✅ required to receive cookie
        body:        JSON.stringify({ ...formData, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLocalError(data.error || 'Verification failed');
        return;
      }

      // ✅ Use setUser — properly sets isAuthenticated + hasFetched: true
      setUser(data.user);
      addToast({ type: 'success', message: 'Account created! Welcome aboard!' });
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
        body:    JSON.stringify({ email: formData.email, purpose: 'signup' }),
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

  const stepNumber = step === 'personal' ? 1 : step === 'company' ? 2 : 3;

  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Create Your Account</h2>
      <p className="text-gray-500 text-sm mb-4 sm:mb-6">Join hundreds of real estate professionals</p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6 sm:mb-8">
        {(['personal', 'company', 'otp'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${stepNumber > i + 1 ? 'bg-emerald-500 text-white' :
                stepNumber === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {stepNumber > i + 1 ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className="ml-1.5 text-xs font-medium hidden sm:block text-gray-500 capitalize">
              {s === 'otp' ? 'Verify' : s}
            </span>
            {i < 2 && (
              <div className={`flex-1 h-1 mx-2 rounded transition-all
                ${stepNumber > i + 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {localError && (
        <Alert type="error" title="Error" message={localError}
          closeable onClose={() => setLocalError('')} />
      )}

      {/* ══ STEP 1: PERSONAL ══ */}
      {step === 'personal' && (
        <form
          onSubmit={e => { e.preventDefault(); if (validateStep1()) { setStep('company'); setErrors({}); } }}
          className="space-y-5">
          <Input label="Full Name" type="text" placeholder="John Doe" className="text-black"
            value={formData.name} onChange={e => update('name', e.target.value)}
            error={errors.name} icon={<User size={18} />} required />
          <Input label="Email Address" type="email" placeholder="john@example.com" className="text-black"
            value={formData.email} onChange={e => update('email', e.target.value)}
            error={errors.email} icon={<Mail size={18} />} required />
          <Input label="Phone Number" type="tel" placeholder="+91 9876543210" className="text-black"
            value={formData.phone} onChange={e => update('phone', e.target.value)}
            error={errors.phone} icon={<Phone size={18} />} helper="Include country code" required />
          <Button type="submit" className="w-full flex items-center justify-center gap-2">
            Continue <ArrowRight size={18} />
          </Button>
        </form>
      )}

      {/* ══ STEP 2: COMPANY ══ */}
      {step === 'company' && (
        <form onSubmit={handleSendOTP} className="space-y-5">
          <Input label="Company Name" type="text" placeholder="ABC Real Estate" className="text-black"
            value={formData.companyName} onChange={e => update('companyName', e.target.value)}
            error={errors.companyName} icon={<Building2 size={18} />} required />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type={showPassword ? 'text' : 'password'} value={formData.password}
                onChange={e => update('password', e.target.value)}
                placeholder="Min 6 chars, 1 uppercase, 1 number"
                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" required />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword}
                onChange={e => update('confirmPassword', e.target.value)}
                placeholder="Re-enter your password"
                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" required />
              <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreeTerms}
              onChange={e => { setAgreeTerms(e.target.checked); setErrors(p => ({ ...p, terms: '' })); }}
              className="w-5 h-5 rounded border-gray-300 mt-0.5" />
            <span className="text-sm text-gray-600">
              I agree to the{' '}
              <Link href="#" className="text-blue-600 hover:text-blue-700">Terms of Service</Link>
              {' '}and{' '}
              <Link href="#" className="text-blue-600 hover:text-blue-700">Privacy Policy</Link>
            </span>
          </label>
          {errors.terms && <p className="text-sm text-red-500">{errors.terms}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1"
              onClick={() => { setStep('personal'); setErrors({}); }}>
              Back
            </Button>
            <Button type="submit" className="flex-1 flex items-center justify-center gap-2" loading={loading}>
              Send OTP <ArrowRight size={18} />
            </Button>
          </div>
        </form>
      )}

      {/* ══ STEP 3: OTP ══ */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOTP} className="space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <ShieldCheck size={20} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Verify your email</p>
              <p className="text-xs text-blue-600 mt-0.5">
                A 6-digit code was sent to <strong>{formData.email}</strong>. Expires in 10 minutes.
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
            Verify & Create Account <ShieldCheck size={18} />
          </Button>

          <button type="button"
            onClick={() => { setStep('company'); setOtp(''); setLocalError(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
            ← Back
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}