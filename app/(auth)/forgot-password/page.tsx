'use client';

import { useState } from 'react';
import Link from 'next/link';

import Alert from '@/components/common/Alert';
import { Mail, ArrowRight, Phone } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import Button from '@/components/common/ Button';
import Input from '@/components/common/ Input';

export default function ForgotPasswordPage() {
  const { addToast } = useToast();
  const [step, setStep] = useState(1); // Step 1: Email, Step 2: OTP
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    try {
      // Get phone number first - you might need to fetch this from API
      // For now, we'll ask user to enter it
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone }),
      });

      if (!response.ok) {
        throw new Error('Failed to send OTP');
      }

      setOtpSent(true);
      setCountdown(300); // 5 minutes
      setStep(2);
      
      addToast({
        type: 'success',
        message: 'OTP sent to your phone. Check your SMS.',
      });

      // Countdown timer
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to send OTP';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      if (!response.ok) {
        throw new Error('Invalid OTP');
      }

      addToast({
        type: 'success',
        message: 'OTP verified! Redirecting to password reset...',
      });

      // Redirect to reset password with email
      window.location.href = `/reset-password?email=${encodeURIComponent(email)}`;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to verify OTP';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
      <p className="text-gray-600 mb-6">
        No problem. We'll help you reset it.
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

      <form onSubmit={step === 1 ? handleRequestOtp : handleVerifyOtp} className="space-y-5">
        {/* Step 1: Email & Phone */}
        {step === 1 && (
          <>
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

            <Input
              label="Phone Number"
              type="tel"
              placeholder="+91 9876543210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError('');
              }}
              icon={<Phone size={18} />}
              helper="We'll send you an OTP on this number"
              required
            />

            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2"
              loading={isLoading}
            >
              Send OTP
              <ArrowRight size={20} />
            </Button>
          </>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                We've sent a 6-digit OTP to your phone number. Enter it below to continue.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                placeholder="000000"
                className="w-full px-4 py-3 text-2xl tracking-widest text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
              {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>

            {/* Countdown Timer */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-sm text-gray-600">
                  OTP expires in: <span className="font-semibold text-red-600">
                    {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-gray-500">OTP expired. Please request a new one.</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2"
              loading={isLoading}
              disabled={!otp || otp.length !== 6}
            >
              Verify OTP
              <ArrowRight size={20} />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setStep(1);
                setOtp('');
                setError('');
              }}
            >
              Back
            </Button>
          </>
        )}
      </form>

      {/* Remember Password? */}
      <p className="mt-6 text-center text-gray-600">
        Remember your password?{' '}
        <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}