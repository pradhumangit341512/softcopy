'use client';

import { useEffect, useState } from 'react';
import { Camera, User, Lock, Settings, LogOut, Eye, EyeOff, Shield, Phone, Mail, Pencil, X, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Input from '@/components/common/ Input';

type TabId = 'profile' | 'security' | 'account';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'profile',  label: 'Profile',  icon: User   },
  { id: 'security', label: 'Security', icon: Lock   },
  { id: 'account',  label: 'Account',  icon: Settings },
];

// ── Role badge ──
const RoleBadge = ({ role }: { role: string }) => {
  const map: Record<string, string> = {
    superadmin: 'bg-purple-50 text-purple-700',
    admin:      'bg-blue-50   text-blue-700',
    user:       'bg-gray-100  text-gray-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${map[role] ?? map.user}`}>
      {role}
    </span>
  );
};

// ── Info row ──
const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-4 py-3.5 border-b border-gray-50 last:border-0">
    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
      <Icon size={16} className="text-gray-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{value || '—'}</p>
    </div>
  </div>
);

// ── Password field with toggle ──
const PasswordInput = ({
  label, value, onChange, required,
}: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full px-4 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
            transition-all bg-white"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
    }
  }, [user]);

  // ── Profile update ──
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error();
      addToast({ type: 'success', message: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch {
      addToast({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  // ── Password change ──
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({ type: 'error', message: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user?.email,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });
      if (!response.ok) throw new Error();
      addToast({ type: 'success', message: 'Password changed successfully!' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      addToast({ type: 'error', message: 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  // ── Avatar initials ──
  const initials = formData.name
    ? formData.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 max-w-2xl">

      {/* ── PAGE HEADER ── */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* ── TABS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-100">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setIsEditing(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold
                transition-all border-b-2
                ${activeTab === id
                  ? 'border-blue-500 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div className="p-5 sm:p-6">
            {!isEditing ? (
              <div className="space-y-1">
                {/* Avatar */}
                <div className="flex items-center gap-4 pb-5 mb-2 border-b border-gray-100">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br
                      from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                      <span className="text-white text-xl sm:text-2xl font-bold">{initials}</span>
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border
                      border-gray-200 rounded-lg flex items-center justify-center shadow-sm
                      hover:bg-gray-50 transition-colors">
                      <Camera size={13} className="text-gray-500" />
                    </button>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{formData.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{formData.email}</p>
                    {user?.role && (
                      <div className="mt-1.5">
                        <RoleBadge role={user.role} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Info rows */}
                <InfoRow icon={User}  label="Full Name" value={formData.name} />
                <InfoRow icon={Mail}  label="Email"     value={formData.email} />
                <InfoRow icon={Phone} label="Phone"     value={formData.phone} />

                {/* Edit button */}
                <div className="pt-4">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                      text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                  >
                    <Pencil size={14} /> Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Edit Profile</h3>
                  <button type="button" onClick={() => setIsEditing(false)}
                    className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                    <X size={15} />
                  </button>
                </div>

                <Input
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                      text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Check size={14} />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 text-sm font-medium text-gray-600
                      border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {activeTab === 'security' && (
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Shield size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Change Password</p>
                <p className="text-xs text-gray-400 mt-0.5">Keep your account secure</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <PasswordInput
                label="Current Password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
              <PasswordInput
                label="New Password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
              />
              <PasswordInput
                label="Confirm New Password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />

              {/* Password match indicator */}
              {passwordForm.confirmPassword && (
                <p className={`text-xs font-medium flex items-center gap-1.5
                  ${passwordForm.newPassword === passwordForm.confirmPassword
                    ? 'text-emerald-600' : 'text-red-500'}`}>
                  {passwordForm.newPassword === passwordForm.confirmPassword
                    ? <><Check size={12} /> Passwords match</>
                    : <><X size={12} /> Passwords don't match</>
                  }
                </p>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                    text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Lock size={14} />
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── ACCOUNT TAB ── */}
        {activeTab === 'account' && (
          <div className="p-5 sm:p-6 space-y-5">

            {/* Role info */}
            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Shield size={15} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Account Role</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    Your permission level
                  </p>
                </div>
              </div>
              {user?.role && <RoleBadge role={user.role} />}
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 py-3.5 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                <Mail size={15} className="text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Email Address</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{user?.email}</p>
              </div>
            </div>

            {/* Logout */}
            <div className="pt-2">
              {!logoutConfirm ? (
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                    text-red-600 bg-red-50 hover:bg-red-100 border border-red-100
                    rounded-xl transition-colors"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              ) : (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">
                    Are you sure you want to sign out?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold
                        text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
                    >
                      <LogOut size={13} /> Yes, Sign Out
                    </button>
                    <button
                      onClick={() => setLogoutConfirm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600
                        bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}