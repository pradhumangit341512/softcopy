'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/common/Toast';

import Alert from '@/components/common/Alert';
import { User, Mail, Phone, Building2, Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import Input from '@/components/common/ Input';
import Button from '@/components/common/ Button';

export default function SignupPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { signup, isLoading } = useAuthStore();

  // Form states
  const [step, setStep] = useState(1); // Step 1: Personal, Step 2: Company
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Validate Step 1
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate Step 2
  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    } else if (formData.companyName.length < 2) {
      newErrors.companyName = 'Company name must be at least 2 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreeTerms) {
      newErrors.terms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Next Step
  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
      setErrors({});
    }
  };

  // Handle Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep2()) {
      return;
    }

    try {
      await signup({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        companyName: formData.companyName,
        password: formData.password,
      });

      addToast({
        type: 'success',
        message: 'Account created successfully! Redirecting to dashboard...',
      });

      router.push('/dashboard');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Signup failed';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    }
  };

  return (
    <div>
      {/* Header */}
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h2>
      <p className="text-gray-600 mb-6">Join hundreds of real estate professionals</p>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {/* Step 1 */}
        <div className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition ${
              step >= 1
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {step > 1 ? <CheckCircle size={20} /> : '1'}
          </div>
          <span className={`ml-2 font-medium ${step >= 1 ? 'text-gray-900' : 'text-gray-500'}`}>
            Personal
          </span>
        </div>

        {/* Line */}
        <div
          className={`flex-1 h-1 transition ${
            step >= 2 ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        ></div>

        {/* Step 2 */}
        <div className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition ${
              step >= 2
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            2
          </div>
          <span className={`ml-2 font-medium ${step >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>
            Company
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={step === 2 ? handleSignup : (e) => { e.preventDefault(); handleNextStep(); }}>
        {/* Step 1: Personal Information */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Full Name */}
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              className='text-black'

              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              error={errors.name}
              icon={<User size={18} />}
              required
            />

            {/* Email */}
            <Input
              label="Email Address"
              type="email"
              placeholder="john@example.com"
              className='text-black'

              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              error={errors.email}
              icon={<Mail size={18} />}
              required
            />

            {/* Phone */}
            <Input
              label="Phone Number"
              type="tel"
              className='text-black'
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (errors.phone) setErrors({ ...errors, phone: '' });
              }}
              error={errors.phone}
              icon={<Phone size={18} />}
              helper="Include country code"
              required
            />

            {/* Next Button */}
            <Button type="submit" className="w-full flex items-center justify-center gap-2">
              Continue
              <ArrowRight size={20} />
            </Button>
          </div>
        )}

        {/* Step 2: Company Information */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Company Name */}
            <Input
              label="Company Name"
              type="text"
              placeholder="ABC Real Estate"
              className='text-black'

              value={formData.companyName}
              onChange={(e) => {
                setFormData({ ...formData, companyName: e.target.value });
                if (errors.companyName) setErrors({ ...errors, companyName: '' });
              }}
              error={errors.companyName}
              icon={<Building2 size={18} />}
              required
            />

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}

                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: '' });
                  }}
                  placeholder="Min 6 chars, 1 uppercase, 1 lowercase, 1 number"
                  className="w-full pl-10 pr-12 py-2 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`w-1 h-1 rounded-full ${
                        formData.password.length >= 6 ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    ></div>
                    <span className={formData.password.length >= 6 ? 'text-green-600' : 'text-gray-500'}>
                      At least 6 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`w-1 h-1 rounded-full ${
                        /[A-Z]/.test(formData.password) ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    ></div>
                    <span className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
                      One uppercase letter
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`w-1 h-1 rounded-full ${
                        /[0-9]/.test(formData.password) ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    ></div>
                    <span className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
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
                  value={formData.confirmPassword}

                  onChange={(e) => {
                    setFormData({ ...formData, confirmPassword: e.target.value });
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                  }}
                  placeholder="Re-enter your password"
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms & Conditions */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  if (errors.terms) setErrors({ ...errors, terms: '' });
                }}
                className="w-5 h-5 rounded border-gray-300 mt-0.5"
              />
              <span className="text-sm text-gray-600">
                I agree to the{' '}
                <Link href="#" className="text-blue-600 hover:text-blue-700">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="#" className="text-blue-600 hover:text-blue-700">
                  Privacy Policy
                </Link>
              </span>
            </label>
            {errors.terms && <p className="text-sm text-red-500">{errors.terms}</p>}

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep(1);
                  setErrors({});
                }}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1 flex items-center justify-center gap-2" loading={isLoading}>
                Create Account
                <ArrowRight size={20} />
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Sign In Link */}
      <p className="mt-6 text-center text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}