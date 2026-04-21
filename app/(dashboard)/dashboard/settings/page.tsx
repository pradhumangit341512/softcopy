'use client';

import { useEffect, useState } from 'react';
import { Camera, User, Lock, Settings, LogOut, Eye, EyeOff, Shield, Phone, Mail, Pencil, X, Check, Monitor, Smartphone, Globe, AlertTriangle, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import { Input } from '@/components/common/Input';

type TabId = 'profile' | 'security' | 'account';

interface Tab { id: TabId; label: string; icon: LucideIcon; adminOnly?: boolean }

const ALL_TABS: Tab[] = [
  { id: 'profile',  label: 'Profile',  icon: User   },
  { id: 'security', label: 'Security', icon: Lock   },
  { id: 'account',  label: 'Account',  icon: Settings, adminOnly: true },
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
const InfoRow = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
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

interface Session {
  id: string;
  loginAt: string;
  ipAddress: string | null;
  device: string;
  isCurrent: boolean;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const tabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({
    otp: '', newPassword: '', confirmPassword: '',
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
    }
  }, [user]);

  // ── Fetch active sessions when Security tab is active ──
  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/auth/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // silent
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'security') fetchSessions();
  }, [activeTab]);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  /** Request an OTP to be emailed for password reset. */
  const handleSendOtp = async () => {
    if (!user?.email) return;
    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: user.email, purpose: 'reset-password' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send code');
      }
      setOtpSent(true);
      setOtpCooldown(30);
      addToast({ type: 'success', message: `Code sent to ${user.email}` });
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send code',
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleRevokeOthers = async () => {
    setRevoking(true);
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      addToast({ type: 'success', message: 'All other sessions have been logged out' });
      setRevokeConfirm(false);
      fetchSessions();
    } catch {
      addToast({ type: 'error', message: 'Failed to revoke sessions' });
    } finally {
      setRevoking(false);
    }
  };

  // ── Profile update ──
  // Email is intentionally excluded — the self-update schema rejects it and
  // only superadmin can change an admin's email.
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: formData.name, phone: formData.phone }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update profile');
      }
      addToast({ type: 'success', message: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update profile',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Password change (OTP-gated) ──
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      addToast({ type: 'error', message: 'Request a code first' });
      return;
    }
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
          otp: passwordForm.otp,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }
      addToast({ type: 'success', message: 'Password changed. Please sign in again.' });
      setPasswordForm({ otp: '', newPassword: '', confirmPassword: '' });
      setOtpSent(false);
      // tokenVersion was bumped — this session will be rejected on next request.
      setTimeout(() => logout(), 1500);
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to change password',
      });
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
          {tabs.map(({ id, label, icon: Icon }) => (
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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="px-4 py-2.5 text-sm text-gray-600 bg-gray-50 rounded-xl border border-gray-200">
                    {formData.email}
                  </p>
                  <p className="text-xs text-gray-400">
                    {user?.role === 'superadmin'
                      ? 'Email is locked for superadmin accounts.'
                      : 'Contact superadmin to change your email.'}
                  </p>
                </div>
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
          <div className="p-5 sm:p-6 space-y-6">

            {/* ── Active Sessions ── */}
            <div>
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Monitor size={18} className="text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Active Sessions</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Devices currently logged into your account
                  </p>
                </div>
                {sessions.length > 1 && (
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    {sessions.length} active
                  </span>
                )}
              </div>

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="ml-2 text-sm">Loading sessions...</span>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No active sessions found</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                        ${s.isCurrent
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-gray-100 bg-gray-50/50'
                        }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                        ${s.isCurrent ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        {s.device.includes('Mobile') || s.device.includes('Android') || s.device.includes('iOS')
                          ? <Smartphone size={15} className={s.isCurrent ? 'text-emerald-600' : 'text-gray-400'} />
                          : <Monitor size={15} className={s.isCurrent ? 'text-emerald-600' : 'text-gray-400'} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">{s.device}</p>
                          {s.isCurrent && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
                              THIS DEVICE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {s.ipAddress && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Globe size={10} /> {s.ipAddress}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(s.loginAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Logout Other Sessions ── */}
              {sessions.filter((s) => !s.isCurrent).length > 0 && (
                <div className="mt-4">
                  {!revokeConfirm ? (
                    <button
                      onClick={() => setRevokeConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                        text-red-600 bg-red-50 hover:bg-red-100 border border-red-100
                        rounded-xl transition-colors"
                    >
                      <LogOut size={14} /> Log out all other sessions
                    </button>
                  ) : (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">
                            Revoke {sessions.filter((s) => !s.isCurrent).length} other session{sessions.filter((s) => !s.isCurrent).length > 1 ? 's' : ''}?
                          </p>
                          <p className="text-xs text-red-500 mt-1">
                            All other devices will be logged out immediately. They&apos;ll need to sign in again.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRevokeOthers}
                          disabled={revoking}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold
                            text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors
                            disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {revoking ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                          {revoking ? 'Revoking...' : 'Yes, log them out'}
                        </button>
                        <button
                          onClick={() => setRevokeConfirm(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-600
                            bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Email Alert Info ── */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
              <Mail size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Login email alerts are active</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  You&apos;ll receive an email at <strong>{user?.email}</strong> whenever
                  someone logs in from a new device or location.
                </p>
              </div>
            </div>

            {/* ── Change Password ── */}
            <div>
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Shield size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Change Password</p>
                  <p className="text-xs text-gray-400 mt-0.5">Keep your account secure</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Step 1: email a one-time code */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Mail size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600">
                      For your safety, we&apos;ll email a 6-digit code to{' '}
                      <strong className="text-gray-800">{user?.email}</strong>.
                      Enter it below to confirm your identity, then set a new password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || otpCooldown > 0}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold
                      text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg
                      transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sendingOtp ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                    {otpCooldown > 0
                      ? `Resend in ${otpCooldown}s`
                      : otpSent
                        ? 'Resend code'
                        : 'Email me a code'}
                  </button>
                </div>

                {/* Step 2: OTP + new password (only shown after code requested) */}
                {otpSent && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Verification code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={passwordForm.otp}
                        onChange={(e) =>
                          setPasswordForm({ ...passwordForm, otp: e.target.value.replace(/\D/g, '') })
                        }
                        required
                        placeholder="6-digit code"
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl
                          tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20
                          focus:border-blue-400 transition-all bg-white"
                      />
                    </div>

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

                    {passwordForm.confirmPassword && (
                      <p className={`text-xs font-medium flex items-center gap-1.5
                        ${passwordForm.newPassword === passwordForm.confirmPassword
                          ? 'text-emerald-600' : 'text-red-500'}`}>
                        {passwordForm.newPassword === passwordForm.confirmPassword
                          ? <><Check size={12} /> Passwords match</>
                          : <><X size={12} /> Passwords don&apos;t match</>
                        }
                      </p>
                    )}

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={loading || passwordForm.otp.length < 4}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                          text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors
                          disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Lock size={14} />
                        {loading ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
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