'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, AlertTriangle, CreditCard, Users } from 'lucide-react';

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

export default function SuperAdminOverview() {
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const totalMRR = companies
    .filter((c) => c.status === 'active')
    .reduce((s, c) => s + (c.monthlyFee ?? 0), 0);

  const expiringSoon = companies.filter((c) => c.expiringSoon && !c.isExpired);
  const expired = companies.filter((c) => c.isExpired);
  const totalSeats = companies.reduce((s, c) => s + c.seatLimit, 0);
  const totalActiveUsers = companies.reduce((s, c) => s + c._count.users, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <Link
          href="/superadmin/companies/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New Company
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Building2} label="Active companies" value={companies.filter((c) => c.status === 'active').length.toString()} sub={`${companies.length} total`} />
        <Stat icon={CreditCard} label="Monthly recurring (MRR)" value={`₹${totalMRR.toLocaleString('en-IN')}`} sub="active customers only" />
        <Stat icon={Users} label="Total users across tenants" value={totalActiveUsers.toString()} sub={`of ${totalSeats} seats`} />
        <Stat
          icon={AlertTriangle}
          label="Need attention"
          value={(expiringSoon.length + expired.length).toString()}
          sub={`${expired.length} expired, ${expiringSoon.length} expiring ≤14d`}
          emphasis={expired.length > 0 || expiringSoon.length > 0 ? 'warn' : undefined}
        />
      </div>

      {(expired.length > 0 || expiringSoon.length > 0) && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="text-amber-900 font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Action needed
          </h2>
          <ul className="text-sm space-y-2">
            {expired.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-red-800">
                  <strong>{c.companyName}</strong> — expired {Math.abs(c.daysUntilExpiry ?? 0)} days ago
                </span>
                <Link href={`/superadmin/companies/${c.id}`} className="text-blue-600 hover:underline">
                  Open →
                </Link>
              </li>
            ))}
            {expiringSoon.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-amber-900">
                  <strong>{c.companyName}</strong> — expires in {c.daysUntilExpiry} days
                </span>
                <Link href={`/superadmin/companies/${c.id}`} className="text-blue-600 hover:underline">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All companies</h2>
        <CompaniesTable companies={companies} />
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  emphasis,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  emphasis?: 'warn';
}) {
  return (
    <div className={`bg-white rounded-lg border p-5 ${emphasis === 'warn' ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <Icon className={`w-6 h-6 ${emphasis === 'warn' ? 'text-amber-500' : 'text-gray-400'}`} />
      </div>
    </div>
  );
}

function CompaniesTable({ companies }: { companies: CompanyRow[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Plan</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Seats</th>
            <th className="px-4 py-3 font-medium">Clients</th>
            <th className="px-4 py-3 font-medium">Expires</th>
            <th className="px-4 py-3 font-medium">Fee</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {companies.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{c.companyName}</td>
              <td className="px-4 py-3 capitalize text-gray-600">{c.plan}</td>
              <td className="px-4 py-3">
                <StatusPill status={c.status} />
              </td>
              <td className="px-4 py-3 text-gray-600">
                {c._count.users} / {c.seatLimit}
              </td>
              <td className="px-4 py-3 text-gray-600">{c._count.clients}</td>
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
          {companies.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                No companies yet. <Link href="/superadmin/companies/new" className="text-blue-600 hover:underline">Create your first one →</Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
