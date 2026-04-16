'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Alert } from '@/components/common/Alert';
import { Mail, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) return setError('Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError('Please enter a valid email');
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'reset-password' }),
      });

      // Server returns a generic "If an account exists…" response whether or not
      // the email matches a real user — enumeration defense. We always advance.
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send reset code');
      }

      addToast({
        type: 'success',
        message: 'If an account exists for that email, a reset code has been sent.',
      });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset code';
      setError(msg);
      addToast({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
      <p className="text-gray-500 text-sm mb-6">
        Enter your email and we&apos;ll send you a code to reset your password.
      </p>

      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          closeable
          onClose={() => setError('')}
        />
      )}

      <form onSubmit={handleRequestOtp} className="space-y-5">
        <Input
          label="Email Address"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          icon={<Mail size={18} />}
          helper="Enter the email associated with your account"
          required
        />

        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2"
          loading={isLoading}
        >
          Send Reset Code
          <ArrowRight size={20} />
        </Button>
      </form>

      <p className="mt-6 text-center text-gray-600">
        Remember your password?{' '}
        <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
