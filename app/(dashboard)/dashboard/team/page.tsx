'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Loader from '@/components/common/Loader';
import Input from '@/components/common/ Input';
import {
  UserPlus, Users, Shield, Eye, EyeOff, Copy, Check,
  ToggleLeft, ToggleRight, Pencil, X, Trash2, Mail, Phone,
  BadgeCheck, Briefcase, Hash,
} from 'lucide-react';
import clsx from 'clsx';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  employeeId?: string;
  designation?: string;
  status: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-50 text-purple-700',
  admin: 'bg-blue-50 text-blue-700',
  user: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-red-50 text-red-600',
};

export default function TeamPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; employeeId: string } | null>(null);

  // New member form
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'user', designation: '',
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', designation: '', role: 'user',
  });

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch team:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const resetForm = () => {
    setForm({ name: '', email: '', phone: '', password: '', role: 'user', designation: '' });
    setShowPassword(false);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const newUser = await res.json();
        addToast({ type: 'success', message: `${newUser.name} added to team!` });

        // Show credentials for admin to share
        setCreatedCredentials({
          email: form.email,
          password: form.password,
          employeeId: newUser.employeeId || 'N/A',
        });

        resetForm();
        setShowAddForm(false);
        fetchMembers();
      } else {
        const err = await res.json();
        addToast({ type: 'error', message: err.error || 'Failed to add member' });
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to add team member' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMember = async (memberId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${memberId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        addToast({ type: 'success', message: 'Member updated successfully' });
        setEditingId(null);
        fetchMembers();
      } else {
        const err = await res.json();
        addToast({ type: 'error', message: err.error || 'Update failed' });
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to update member' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        addToast({
          type: 'success',
          message: `${member.name} is now ${newStatus}`,
        });
        fetchMembers();
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to update status' });
    }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    if (!confirm(`Are you sure you want to remove ${member.name} from the team? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        addToast({ type: 'success', message: `${member.name} removed from team` });
        fetchMembers();
      } else {
        const err = await res.json();
        addToast({ type: 'error', message: err.error || 'Delete failed' });
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to remove member' });
    }
  };

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setEditForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      designation: member.designation || '',
      role: member.role,
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  if (loading) return <Loader fullScreen size="lg" message="Loading team..." />;

  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';
  const selectStyle = 'w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Team Management
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Add members, assign roles, and manage your team
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setShowAddForm(!showAddForm); setCreatedCredentials(null); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white
              bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors self-start sm:self-auto"
          >
            <UserPlus size={16} />
            Add Member
          </button>
        )}
      </div>

      {/* Created Credentials Card */}
      {createdCredentials && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BadgeCheck size={20} className="text-green-600" />
              <h3 className="text-sm font-bold text-green-800">Team Member Created Successfully!</h3>
            </div>
            <button onClick={() => setCreatedCredentials(null)}
              className="text-green-400 hover:text-green-600">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-green-700">Share these login credentials with the team member:</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-3 border border-green-100">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Employee ID</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm font-bold text-gray-800">{createdCredentials.employeeId}</p>
                <button onClick={() => copyToClipboard(createdCredentials.employeeId, 'empId')}
                  className="text-gray-400 hover:text-blue-500">
                  {copiedField === 'empId' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-green-100">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Email (Login)</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm font-bold text-gray-800 truncate">{createdCredentials.email}</p>
                <button onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                  className="text-gray-400 hover:text-blue-500 shrink-0 ml-2">
                  {copiedField === 'email' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-green-100">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Password</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm font-bold text-gray-800 font-mono">{createdCredentials.password}</p>
                <button onClick={() => copyToClipboard(createdCredentials.password, 'pass')}
                  className="text-gray-400 hover:text-blue-500 shrink-0 ml-2">
                  {copiedField === 'pass' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Form */}
      {showAddForm && isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <UserPlus size={16} className="text-blue-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">Add New Team Member</h2>
            </div>
            <button onClick={() => { setShowAddForm(false); resetForm(); }}
              className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Email (Login ID) *"
                type="email"
                placeholder="rahul@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone *"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
              <div>
                <label className={labelStyle}>Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Designation"
                placeholder="e.g. Sales Executive"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
              <div>
                <label className={labelStyle}>Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={selectStyle}
                >
                  <option value="user">Team Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white
                  bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <UserPlus size={15} />
                {saving ? 'Creating...' : 'Create Member'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); resetForm(); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-600
                  border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Team Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Total Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{members.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {members.filter((m) => m.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Admins</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {members.filter((m) => m.role === 'admin' || m.role === 'superadmin').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Inactive</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {members.filter((m) => m.status === 'inactive').length}
          </p>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Users size={16} className="text-blue-500" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">Team Members</h2>
        </div>

        <div className="divide-y divide-gray-50">
          {members.map((member) => {
            const initials = member.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const isMe = member.id === user?.id;
            const isEditing = editingId === member.id;

            return (
              <div key={member.id} className={clsx('px-4 sm:px-6 py-4', isMe && 'bg-blue-50/20')}>
                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">Edit Member</h3>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                      <Input
                        label="Phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                      <Input
                        label="Designation"
                        value={editForm.designation}
                        onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className={selectStyle}
                      >
                        <option value="user">Team Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateMember(member.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white
                          bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60"
                      >
                        <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-600
                          border border-gray-200 hover:bg-gray-50 rounded-xl"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={clsx(
                        'w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0',
                        member.status === 'active'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                          : 'bg-gray-300'
                      )}>
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                          {isMe && (
                            <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">You</span>
                          )}
                          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', ROLE_COLORS[member.role] || ROLE_COLORS.user)}>
                            {member.role}
                          </span>
                          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[member.status] || STATUS_COLORS.active)}>
                            {member.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                          {member.designation && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Briefcase size={10} /> {member.designation}
                            </span>
                          )}
                          {member.employeeId && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Hash size={10} /> {member.employeeId}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail size={10} /> {member.email}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone size={10} /> {member.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isAdmin && !isMe && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => startEdit(member)}
                          title="Edit member"
                          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center
                            text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(member)}
                          title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                          className={clsx(
                            'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
                            member.status === 'active'
                              ? 'border-green-200 text-green-500 hover:bg-green-50'
                              : 'border-red-200 text-red-400 hover:bg-red-50'
                          )}
                        >
                          {member.status === 'active' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>

                        <button
                          onClick={() => handleDeleteMember(member)}
                          title="Remove member"
                          className="w-8 h-8 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center
                            text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No team members yet. Add your first member above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
