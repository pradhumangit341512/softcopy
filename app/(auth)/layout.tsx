import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Auth - Real Estate CRM',
  description: 'Login or sign up to your Real Estate CRM account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Left Side - Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center">
        <div className="max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              RE
            </div>
            <h1 className="text-3xl font-bold text-gray-900">CRM</h1>
          </div>

          {/* Tagline */}
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Manage Your Real Estate Business
          </h2>

          <p className="text-xl text-gray-600 mb-8">
            Complete CRM solution for real estate builders and brokers. Track clients,
            visits, follow-ups, and commissions in one place.
          </p>

          {/* Features List */}
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                ✓
              </div>
              <span className="text-gray-700">Client Management</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                ✓
              </div>
              <span className="text-gray-700">Visit & Follow-up Tracking</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                ✓
              </div>
              <span className="text-gray-700">Commission Tracking</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                ✓
              </div>
              <span className="text-gray-700">WhatsApp Automation</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Mobile Logo - Show only on mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              RE
            </div>
            <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
          </div>

          {/* Forms will be rendered here */}
          {children}
        </div>

        {/* Bottom Links */}
        <div className="text-center mt-6 text-gray-600">
          <p>
            Protected by industry-standard security and encryption
          </p>
        </div>
      </div>
    </div>
  );
}