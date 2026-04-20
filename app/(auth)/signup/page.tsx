'use client';

/**
 * Option-A signup UI: single form (no OTP). On successful submit the server
 * creates a pending-verification account and emails a link. We render a
 * "check your email" confirmation state.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight,
  User as UserIcon, Phone, Building2, CheckCircle,
} from 'lucide-react';

import { useToast } from '@/components/common/Toast';
import { Alert } from '@/components/common/Alert';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { api, ApiError } from '@/lib/fetch';

type SignupResponse = {
  success: true;
  message: string;
  __dev?: { verifyLink?: string };
};

export default function SignupPage() {
  const { addToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    companyName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setFieldErrors((p) => ({ ...p, [field]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Please enter a valid email';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Min 6 characters';
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Must include an uppercase letter';
    else if (!/[a-z]/.test(form.password)) errs.password = 'Must include a lowercase letter';
    else if (!/[0-9]/.test(form.password)) errs.password = 'Must include a number';
    if (!form.companyName.trim() || form.companyName.trim().length < 2) errs.companyName = 'Company name is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const applyApiError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      if (err.fields) setFieldErrors((p) => ({ ...p, ...err.fields }));
      setFormError(err.message || fallback);
    } else {
      setFormError(fallback);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post<SignupResponse>('/api/auth/signup', {
        ...form,
        email: form.email.trim(),
      });
      setDevLink(res.__dev?.verifyLink ?? null);
      setSubmitted(true);
      addToast({ type: 'success', message: res.message });
    } catch (err) {
      applyApiError(err, 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-emerald-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-600 text-sm mb-6 max-w-sm mx-auto">
          We sent a verification link to <strong>{form.email}</strong>. Click it to activate
          your account, then come back to sign in.
        </p>

        {devLink && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-amber-800 mb-2">DEV MODE — link echo</p>
            <a
              href={devLink}
              className="text-xs text-amber-700 underline break-all font-mono"
            >
              {devLink}
            </a>
          </div>
        )}

        <div className="space-y-3">
          <Link href="/login">
            <Button className="w-full">Go to sign in</Button>
          </Link>
          <p className="text-xs text-gray-500">
            Didn&apos;t get it? Check your spam folder or{' '}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              try again
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Create your account</h2>
      <p className="text-gray-500 mb-6 text-sm">
        Start your 30-day free trial. No credit card required.
      </p>

      {formError && (
        <Alert type="error" title="Error" message={formError} closeable onClose={() => setFormError('')} />
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input
          label="Full Name"
          value={form.name}
          onChange={update('name')}
          disabled={loading}
          error={fieldErrors.name}
          icon={<UserIcon size={18} />}
          className="text-black"
          autoComplete="name"
          required
        />

        <Input
          label="Company Name"
          value={form.companyName}
          onChange={update('companyName')}
          disabled={loading}
          error={fieldErrors.companyName}
          icon={<Building2 size={18} />}
          className="text-black"
          autoComplete="organization"
          required
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={update('email')}
          disabled={loading}
          error={fieldErrors.email}
          icon={<Mail size={18} />}
          className="text-black"
          autoComplete="email"
          required
        />

        <Input
          label="Phone"
          type="tel"
          placeholder="+91 98765 43210"
          value={form.phone}
          onChange={update('phone')}
          disabled={loading}
          error={fieldErrors.phone}
          icon={<Phone size={18} />}
          className="text-black"
          autoComplete="tel"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              disabled={loading}
              placeholder="At least 6 chars, mix of letters + number"
              className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-black
                disabled:bg-gray-50 disabled:text-gray-500"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password && <p className="mt-1 text-sm text-red-500">{fieldErrors.password}</p>}
        </div>

        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2"
          loading={loading}
        >
          Create account <ArrowRight size={18} />
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-sm text-gray-400">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <p className="text-center text-gray-600 text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
