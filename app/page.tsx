'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import {
  BarChart3,
  Users,
  MessageSquare,
  DollarSign,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import Button from '@/components/common/ Button';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show nothing while checking auth
  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              RE
            </div>
            <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition">
              Features
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition">
              Pricing
            </a>
            <a href="#contact" className="text-gray-600 hover:text-gray-900 transition">
              Contact
            </a>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Manage Your Real Estate Business
            <span className="block text-blue-600">Like Never Before</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Complete CRM solution for real estate builders and brokers. Track clients,
            manage visits, follow-ups, and commissions—all in one place.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link href="/signup">
              <Button size="lg" className="flex items-center gap-2">
                Start Free Trial
                <ArrowRight size={20} />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Hero Image / Stats */}
          <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl p-12 mb-20">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600">1000+</div>
                <p className="text-gray-600 mt-2">Active Users</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600">50K+</div>
                <p className="text-gray-600 mt-2">Clients Managed</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600">₹100Cr+</div>
                <p className="text-gray-600 mt-2">In Commissions Tracked</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-16">
            Powerful Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition">
              <Users className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Client Management</h3>
              <p className="text-gray-600">
                Organize and manage all your clients in one centralized database with advanced
                filtering and search capabilities.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition">
              <BarChart3 className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Visit Tracking</h3>
              <p className="text-gray-600">
                Schedule and track client visits with automated reminders and follow-up
                notifications.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition">
              <DollarSign className="w-12 h-12 text-yellow-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Commission Tracking</h3>
              <p className="text-gray-600">
                Automatically calculate and track commissions with detailed reports and
                payment status.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition">
              <MessageSquare className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">WhatsApp Integration</h3>
              <p className="text-gray-600">
                Send automated reminders and updates to clients via WhatsApp for better
                engagement.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition">
              <BarChart3 className="w-12 h-12 text-red-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Advanced Analytics</h3>
              <p className="text-gray-600">
                Get insights into your business with detailed charts, graphs, and performance
                metrics.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition">
              <Shield className="w-12 h-12 text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Enterprise Security</h3>
              <p className="text-gray-600">
                Bank-grade security with end-to-end encryption and multi-factor authentication.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-16">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sign Up</h3>
              <p className="text-gray-600">Create your account in minutes</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Add Clients</h3>
              <p className="text-gray-600">Import or manually add your clients</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Track Progress</h3>
              <p className="text-gray-600">Monitor visits and follow-ups</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Grow Business</h3>
              <p className="text-gray-600">Increase sales and track earnings</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-16">
            Simple, Transparent Pricing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Basic Plan */}
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic</h3>
              <p className="text-gray-600 mb-6">Perfect for getting started</p>
              <div className="text-4xl font-bold text-gray-900 mb-6">
                ₹999<span className="text-lg text-gray-600">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>1 User</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Unlimited Clients</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Basic Reports</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Email Support</span>
                </li>
              </ul>

              <Link href="/signup">
                <Button className="w-full" variant="outline">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-xl border-2 border-blue-600 p-8 relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Popular
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
              <p className="text-gray-600 mb-6">For growing teams</p>
              <div className="text-4xl font-bold text-gray-900 mb-6">
                ₹4,999<span className="text-lg text-gray-600">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Up to 5 Users</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Unlimited Clients</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Advanced Analytics</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Export Data</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Priority Support</span>
                </li>
              </ul>

              <Link href="/signup">
                <Button className="w-full">Get Started</Button>
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-6">For large organizations</p>
              <div className="text-4xl font-bold text-gray-900 mb-6">
                ₹9,999<span className="text-lg text-gray-600">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Unlimited Users</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Unlimited Everything</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>WhatsApp Automation</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Custom Integrations</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span>Dedicated Support</span>
                </li>
              </ul>

              <Link href="/signup">
                <Button className="w-full" variant="outline">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Business?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of real estate professionals using our CRM
          </p>
          <Link href="/signup">
            <Button size='lg' variant="outline" className='bg-white'>
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                  RE
                </div>
                <span className="text-xl font-bold">CRM</span>
              </div>
              <p className="text-gray-400">
                Complete CRM solution for real estate professionals
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#features" className="hover:text-white transition">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Security
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Careers
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <p className="text-center text-gray-400">
              © 2024 Real Estate CRM. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}