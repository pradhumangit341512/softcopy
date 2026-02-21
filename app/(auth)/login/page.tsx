'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/common/Toast';
import Alert from '@/components/common/Alert';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Input from '@/components/common/ Input';
import Button from '@/components/common/ Button';

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { login, isLoading, error: authError } = useAuthStore();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');

  // Validation
  const validateForm = () => {
    const newErrors = { email: '', password: '' };
    let isValid = true;

    if (!email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!validateForm()) {
      return;
    }

    try {
      await login(email, password);
      addToast({
        type: 'success',
        message: 'Login successful! Redirecting...',
      });
      router.push('/dashboard');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Login failed';
      setLocalError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
      });
    }
  };

  return (
    <div>
      {/* Header */}
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
      <p className="text-gray-600 mb-6">Sign in to your Real Estate CRM account</p>

      {/* Error Alert */}
      {(localError || authError) && (
        <Alert
          type="error"
          title="Login Failed"
          message={localError || authError}
          closeable
          onClose={() => setLocalError('')}
        />
      )}

      {/* Login Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        {/* Email Field */}
        <Input
        className='text-black'
          label="Email Address"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors({ ...errors, email: '' });
          }}
          error={errors.email}
          icon={<Mail size={18} />}
          required
        />

        {/* Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              placeholder="Enter your password"
              className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              required
            />
            <Button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
          {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-black" />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
            Forgot password?
          </Link>
        </div>

        {/* Login Button */}
        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2"
          loading={isLoading}
        >
          Sign In
          <ArrowRight size={20} />
        </Button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="text-sm text-gray-500">Or</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      {/* Social Login (Optional) */}
      <div className="space-y-3">
        <Button variant="outline" className="w-full">
          🔵 Continue with Google
        </Button>
        <Button variant="outline" className="w-full">
          🟦 Continue with Facebook
        </Button>
      </div>

      {/* Sign Up Link */}
      <p className="mt-6 text-center text-gray-600">
        Don't have an account?{' '}
        <Link href="/signup" className="text-blue-600 font-semibold hover:text-blue-700">
          Sign up
        </Link>
      </p>

      {/* Demo Credentials (For Development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-semibold mb-2">Demo Credentials:</p>
          <p className="text-sm text-yellow-700">Email: demo@example.com</p>
          <p className="text-sm text-yellow-700">Password: DemoPass123</p>
        </div>
      )}
    </div>
  );
}