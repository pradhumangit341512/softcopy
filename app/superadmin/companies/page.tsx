'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CompanyRow {
  id: string;
  companyName: string;
  plan: string;
  status: string;
  seatLimit: number;
  monthlyFee: number | null;
  subscriptionUntil: string | null;
  daysUntilExpiry: number | null;
  isExpired: boolean;
  expiringSoon: boolean;
  _count: { users: number; clients: number; properties: number; commissions: number };
}

export default function CompaniesListPage() {
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expired'>('all');

  useEffect(() => {
    let alive = true;
    fetch('/api/superadmin/companies')
      .then((r) => r.json())
      .then((j) => alive && setCompanies(j.companies ?? []))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!companies) return <div className="text-gray-500">Loading…</div>;

  const filtered = companies
    .filter((c) => statusFilter === 'all' || c.status === statusFilter)
    .filter((c) => !search || c.companyName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <Link
          href="/superadmin/companies/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New Company
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-60"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Seats</th>
              <th className="px-4 py-3 font-medium">Clients / Props</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.companyName}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{c.plan}</td>
                <td className="px-4 py-3">
                  <StatusPill status={c.status} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c._count.users} / {c.seatLimit}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c._count.clients} / {c._count.properties}
                </td>
                <td className="px-4 py-3">
                  {c.daysUntilExpiry === null ? (
                    <span className="text-gray-400">—</span>
                  ) : c.isExpired ? (
                    <span className="text-red-600">Expired</span>
                  ) : c.expiringSoon ? (
                    <span className="text-amber-700">{c.daysUntilExpiry}d left</span>
                  ) : (
                    <span className="text-gray-600">{c.daysUntilExpiry}d</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {c.monthlyFee ? `₹${c.monthlyFee.toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/superadmin/companies/${c.id}`} className="text-blue-600 hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  No companies match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-50 text-green-700 border-green-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    expired: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  return (
    <span className={`inline-block text-xs font-medium border px-2 py-0.5 rounded ${map[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}
