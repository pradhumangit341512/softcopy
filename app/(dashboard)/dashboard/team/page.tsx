'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Mail, Phone, Trash2, Shield, X, UserCheck, UserX, Pencil } from 'lucide-react';

import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import { formatDate } from '@/lib/utils';

/** Team member record returned by /api/users */
interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'user' | 'superadmin';
  status: string;
  createdAt: string;
}

interface NewMemberForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'admin' | 'user';
}

/**
 * Team page — admin/superadmin only.
 * Lists all team members. Allows adding, removing, and viewing team members.
 */
export default function TeamPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewMemberForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
  });

  // Edit modal state
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '' as string });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.status === 403) {
        setError('Only admins can access the team page');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch team members');
      const data = await res.json();
      const list = data.users ?? data;
      setMembers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    // Redirect non-admins away
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      router.replace('/dashboard');
      return;
    }

    fetchMembers();
  }, [authLoading, user, router, fetchMembers]);

  /** Reset and close the add-member modal */
  const closeModal = () => {
    setShowAddModal(false);
    setForm({ name: '', email: '', phone: '', password: '', role: 'user' });
  };

  /** Submit the new member form */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add team member');
      }

      addToast({ type: 'success', message: 'Team member added!' });
      closeModal();
      fetchMembers();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to add team member',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** Remove a team member */
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the team? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }
      addToast({ type: 'success', message: 'Team member removed' });
      fetchMembers();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove member',
      });
    }
  };

  /** Toggle active/inactive — data stays safe, user just can't login */
  const handleToggleStatus = async (id: string, name: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    if (!confirm(`${action === 'activate' ? 'Activate' : 'Deactivate'} ${name}? ${
      action === 'deactivate'
        ? 'They will not be able to log in, but all their data (clients, properties, commissions) will be preserved.'
        : 'They will be able to log in again.'
    }`)) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} member`);
      }
      addToast({ type: 'success', message: `${name} ${action}d successfully` });
      fetchMembers();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : `Failed to ${action} member`,
      });
    }
  };

  /** Open edit modal pre-filled with member's current data */
  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm({ name: member.name, email: member.email, phone: member.phone, role: member.role });
  };

  /** Save edited member details */
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update member');
      }
      addToast({ type: 'success', message: `${editForm.name} updated successfully` });
      setEditingMember(null);
      fetchMembers();
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update member',
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="py-8">
        <Loader size="lg" message="Loading team..." />
      </div>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return null;
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Team
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Manage your team members
            {members.length > 0 && (
              <span className="ml-1.5 text-gray-400">— {members.length} total</span>
            )}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5
            text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
            rounded-xl shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Add Member</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {error && (
        <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
      )}

      {/* TEAM LIST */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Users size={14} className="text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">
            Team Members
            <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {members.length}
            </span>
          </h3>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
              <Users size={22} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No team members yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              + Add your first team member
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((member) => {
              const initials = member.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              const isSelf = member.id === user?.id;

              return (
                <div
                  key={member.id}
                  className="px-4 sm:px-5 py-4 sm:py-5 hover:bg-gray-50/60 transition-colors"
                >
                  {/* Top row: Avatar + Name + Status */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600
                      flex items-center justify-center text-white text-sm sm:text-base font-bold shrink-0">
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
                          {member.name}
                        </p>
                        {isSelf && (
                          <span className="text-xs text-gray-400">(You)</span>
                        )}
                        <Badge
                          label={member.role}
                          variant={
                            member.role === 'admin' || member.role === 'superadmin'
                              ? 'primary'
                              : 'gray'
                          }
                          size="sm"
                        />
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          member.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1.5">
                          <Mail size={13} className="text-gray-400" /> {member.email}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1.5">
                          <Phone size={13} className="text-gray-400" /> {member.phone}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {formatDate(member.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons — full width row below info on mobile */}
                  <div className="flex items-center gap-2 mt-3 pl-14 sm:pl-15 flex-wrap">
                    {/* Edit — always visible */}
                    <button
                      onClick={() => openEditModal(member)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium
                        rounded-lg border border-blue-200 bg-blue-50 text-blue-600
                        hover:bg-blue-100 active:bg-blue-200 transition-colors"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    {/* Activate/Deactivate/Delete — only for OTHER members */}
                    {!isSelf && (
                      <>
                        <button
                          onClick={() => handleToggleStatus(member.id, member.name, member.status)}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium
                            rounded-lg border transition-colors active:scale-95 ${
                            member.status === 'active'
                              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {member.status === 'active' ? (
                            <><UserX size={14} /> Deactivate</>
                          ) : (
                            <><UserCheck size={14} /> Activate</>
                          )}
                        </button>

                        <button
                          onClick={() => handleDelete(member.id, member.name)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium
                            rounded-lg border border-red-200 bg-red-50 text-red-600
                            hover:bg-red-100 active:bg-red-200 transition-colors"
                        >
                          <Trash2 size={14} />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center
          justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Shield size={18} className="text-blue-500" />
                Add Team Member
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <Input
                label="Full Name *"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Email *"
                type="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                label="Phone *"
                type="tel"
                placeholder="+91 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
              <Input
                label="Password *"
                type="password"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as 'admin' | 'user' })
                  }
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300
                    rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">Team Member (sees only their own data)</option>
                  <option value="admin">Admin (sees all company data)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  loading={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Adding...' : 'Add Member'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT MODAL */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center
          justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Pencil size={18} className="text-blue-500" />
                Edit {editingMember.name}
              </h2>
              <button
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-5 space-y-4">
              <Input
                label="Full Name"
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
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300
                    rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">Team Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <p className="font-medium text-gray-700 mb-1">Status: {editingMember.status === 'active' ? 'Active' : 'Inactive'}</p>
                <p>Use the Activate/Deactivate button on the team list to change status. Deactivated members cannot log in but all their data stays safe.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={editSubmitting} className="flex-1">
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingMember(null)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
