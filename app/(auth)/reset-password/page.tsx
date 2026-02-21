'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Alert from '@/components/common/Alert';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import Button from '@/components/common/ Button';
import Input from '@/components/common/ Input';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  
  const email = searchParams.get('email') || '';

  // Form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate password
  const validatePassword = () => {
    setError('');

    if (!newPassword) {
      setError('New password is required');
      return false;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      return false;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError('Password must contain at least one lowercase letter');
      return false;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number');
      return false;
    }

    if (!confirmPassword) {
      setError('Please confirm your password');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  // Handle password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset password');
      }

      setSuccess(true);
      addToast({
        type: 'success',
        message: 'Password reset successful! Redirecting to login...',
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to reset password';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  // Success State
  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-green-600" size={32} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Password Reset Successful</h2>
        <p className="text-gray-600 mb-8">
          Your password has been changed. You'll be redirected to the login page shortly.
        </p>
        <Link href="/login">
          <Button>Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
      <p className="text-gray-600 mb-6">
        Enter your new password below. Make sure it's strong and secure.
      </p>

      {/* Error Alert */}
      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          closeable
          onClose={() => setError('')}
        />
      )}

      {/* Reset Form */}
      <form onSubmit={handleResetPassword} className="space-y-5">
        {/* Email (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <Input
            type="email"
            value={email}
            disabled
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter new password"
              className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {newPassword && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={`w-1 h-1 rounded-full ${
                    newPassword.length >= 6 ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                ></div>
                <span className={newPassword.length >= 6 ? 'text-green-600' : 'text-gray-500'}>
                  At least 6 characters
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={`w-1 h-1 rounded-full ${
                    /[A-Z]/.test(newPassword) ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                ></div>
                <span className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-gray-500'}>
                  One uppercase letter
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={`w-1 h-1 rounded-full ${
                    /[0-9]/.test(newPassword) ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                ></div>
                <span className={/[0-9]/.test(newPassword) ? 'text-green-600' : 'text-gray-500'}>
                  One number
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError('');
              }}
              placeholder="Re-enter your password"
              className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password Match Indicator */}
          {newPassword && confirmPassword && (
            <div className="mt-2">
              {newPassword === confirmPassword ? (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle size={16} />
                  <span>Passwords match</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <span>Passwords do not match</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Requirements */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Password Requirements:</p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ At least 6 characters long</li>
            <li>✓ Contains uppercase letters (A-Z)</li>
            <li>✓ Contains lowercase letters (a-z)</li>
            <li>✓ Contains numbers (0-9)</li>
          </ul>
        </div>

        {/* Reset Button */}
        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2"
          loading={isLoading}
          disabled={!newPassword || !confirmPassword}
        >
          Reset Password
          <ArrowRight size={20} />
        </Button>
      </form>

      {/* Back to Login */}
      <p className="mt-6 text-center text-gray-600">
        <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
          Back to login
        </Link>
      </p>
    </div>
  );
}