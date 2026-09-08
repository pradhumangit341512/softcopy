'use client';

/**
 * SuperAdmin → Certificates list. Search/filter issued internship
 * certificates, jump to the create form, and revoke/reinstate/delete.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Plus,
  Search,
  Eye,
  Ban,
  RotateCcw,
  Trash2,
  Loader2,
} from 'lucide-react';

interface CertRow {
  id: string;
  certificateId: string;
  internName: string;
  role: string;
  team: string;
  startDate: string;
  endDate: string;
  issueDate: string;
  status: 'active' | 'revoked';
  createdAt: string;
}

export default function CertificatesListPage() {
  const [rows, setRows] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (status) qs.set('status', status);
      const res = await fetch(`/api/superadmin/certificates?${qs.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed to load certificates');
      setRows(j.certificates);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search/filter changes
    return () => clearTimeout(t);
  }, [load]);

  async function setStatusFor(id: string, next: 'active' | 'revoked') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/superadmin/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Update failed');
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, certificateId: string) {
    if (!confirm(`Delete certificate ${certificateId}? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/superadmin/certificates/${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Delete failed');
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Award className="h-6 w-6 text-amber-500" />
            Internship Certificates
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Issue, verify, and manage internship certificates.
          </p>
        </div>
        <Link
          href="/superadmin/certificates/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Issue certificate
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by intern, ID, or role…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Intern</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Certificate ID</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  No certificates yet.{' '}
                  <Link href="/superadmin/certificates/new" className="text-blue-600 hover:underline">
                    Issue the first one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.internName}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{r.role}</td>
                  <td className="px-4 py-3 text-gray-700">{r.team}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {r.certificateId}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(r.issueDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/superadmin/certificates/${r.id}`}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                        title="View / download"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {r.status === 'active' ? (
                        <button
                          onClick={() => setStatusFor(r.id, 'revoked')}
                          disabled={busyId === r.id}
                          className="rounded p-1.5 text-gray-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
                          title="Revoke"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setStatusFor(r.id, 'active')}
                          disabled={busyId === r.id}
                          className="rounded p-1.5 text-gray-500 hover:bg-green-50 hover:text-green-600 disabled:opacity-40"
                          title="Reinstate"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => remove(r.id, r.certificateId)}
                        disabled={busyId === r.id}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
