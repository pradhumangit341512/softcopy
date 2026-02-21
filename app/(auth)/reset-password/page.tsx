'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Alert from '@/components/common/Alert';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import Button from '@/components/common/ Button';
import Input from '@/components/common/ Input';

/* ============================= */
/* MAIN WRAPPER (Suspense Fix)  */
/* ============================= */

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

/* ============================= */
/* ACTUAL PAGE CONTENT           */
/* ============================= */

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validatePassword = () => {
    setError('');

    if (!newPassword) return setError('New password is required'), false;
    if (newPassword.length < 6) return setError('Minimum 6 characters'), false;
    if (!/[A-Z]/.test(newPassword)) return setError('Must contain uppercase'), false;
    if (!/[a-z]/.test(newPassword)) return setError('Must contain lowercase'), false;
    if (!/[0-9]/.test(newPassword)) return setError('Must contain number'), false;
    if (!confirmPassword) return setError('Confirm your password'), false;
    if (newPassword !== confirmPassword) return setError('Passwords do not match'), false;

    return true;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword, confirmPassword }),
      });

      if (!response.ok) throw new Error('Failed to reset password');

      setSuccess(true);

      addToast({
        type: 'success',
        message: 'Password reset successful! Redirecting...',
      });

      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      const msg = err?.message || 'Reset failed';
      setError(msg);
      addToast({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  /* ============================= */
  /* SUCCESS VIEW                  */
  /* ============================= */

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-green-600" size={32} />
        </div>
        <h2 className="text-3xl font-bold mb-2">Password Reset Successful</h2>
        <p className="text-gray-600 mb-8">
          Redirecting to login page...
        </p>
        <Link href="/login">
          <Button>Go to Login</Button>
        </Link>
      </div>
    );
  }

  /* ============================= */
  /* FORM VIEW                     */
  /* ============================= */

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Reset Password</h2>
      <p className="text-gray-600 mb-6">
        Enter your new secure password.
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

      <form onSubmit={handleResetPassword} className="space-y-5">

        {/* EMAIL */}
        <Input type="email" value={email} disabled label="Email Address" />

        {/* NEW PASSWORD */}
        <div className="relative">
          <Input
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e: any) => setNewPassword(e.target.value)}
            label="New Password"
            required
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-10 text-gray-400"
          >
            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* CONFIRM PASSWORD */}
        <div className="relative">
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e: any) => setConfirmPassword(e.target.value)}
            label="Confirm Password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-10 text-gray-400"
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Button
          type="submit"
          loading={isLoading}
          disabled={!newPassword || !confirmPassword}
          className="w-full flex items-center justify-center gap-2"
        >
          Reset Password
          <ArrowRight size={20} />
        </Button>
      </form>

      <p className="mt-6 text-center">
        <Link href="/login" className="text-blue-600 font-semibold">
          Back to login
        </Link>
      </p>
    </div>
  );
}