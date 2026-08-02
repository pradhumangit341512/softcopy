'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, Pencil, CalendarCheck, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { StatCard, EmptyBlock } from '@/components/common/StatCard';
import { formatCurrency } from '@/lib/utils';
import { PayrollProfileModal, type PayrollMember } from '@/components/payroll/PayrollProfileModal';

/**
 * HR / Payroll setup (Enterprise HR plan). Admin configures each team member's
 * base salary, allowances, absence policy, and commission rate. Server-side
 * routes enforce the same feature + admin gating — this page is the UI.
 */
export default function PayrollPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canPayroll = useFeature('feature.payroll');
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [members, setMembers] = useState<PayrollMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PayrollMember | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payroll/profiles', { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load payroll');
      setMembers(j.members ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdmin || !canPayroll) return;
    fetchMembers();
  }, [authLoading, user?.id, isAdmin, canPayroll, fetchMembers]);

  if (authLoading) {
    return <div className="py-16"><Loader size="lg" message="Loading..." /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">
        Payroll is managed by your admin.
      </div>
    );
  }
  if (!canPayroll) {
    return <FeatureLocked feature="feature.payroll" />;
  }

  const onPayrollCount = members.filter((m) => m.profile?.active).length;
  const monthlyPayroll = members.reduce((sum, m) => {
    const p = m.profile;
    if (!p?.active) return sum;
    return sum + p.baseSalary + (p.travelAllowance ?? 0) + (p.otherAllowance ?? 0);
  }, 0);

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
            <Wallet size={24} className="text-blue-600" /> Payroll
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Set base salary, allowances, absence policy, and commission rate per team member
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/payroll/attendance" className="flex-1 sm:flex-none">
            <button className="w-full flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold
              text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl shadow-sm transition-colors whitespace-nowrap">
              <CalendarCheck size={15} /> Attendance
            </button>
          </Link>
          <Link href="/dashboard/payroll/payslips" className="flex-1 sm:flex-none">
            <button className="w-full flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold
              text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors whitespace-nowrap">
              <FileText size={15} /> Payslips
            </button>
          </Link>
        </div>
      </div>

      {/* Summary */}
      {!loading && members.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="On payroll" value={`${onPayrollCount} / ${members.length}`} hint="active members" />
          <StatCard label="Monthly payroll" value={formatCurrency(monthlyPayroll)} hint="base + allowances" />
          <StatCard
            label="Avg. package"
            value={onPayrollCount ? formatCurrency(Math.round(monthlyPayroll / onPayrollCount)) : '—'}
            hint="per active member"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      )}

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12"><Loader message="Loading team..." /></div>
        ) : members.length === 0 ? (
          <EmptyBlock icon={<Wallet size={26} />} text="No active team members found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Designation</th>
                  <th className="px-4 py-3 text-right">Base salary</th>
                  <th className="px-4 py-3 text-right">Allowances</th>
                  <th className="px-4 py-3 text-left">Absence cut</th>
                  <th className="px-4 py-3 text-center">Paid leaves</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-center">On payroll</th>
                  <th className="px-4 py-3 text-center">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {members.map((m) => {
                  const p = m.profile;
                  const allowances = (p?.travelAllowance ?? 0) + (p?.otherAllowance ?? 0);
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 leading-tight">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p?.designation || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{p ? formatCurrency(p.baseSalary) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{p ? formatCurrency(allowances) : '—'}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {!p ? '—' : p.perAbsentDeduction == null ? <span className="text-gray-400">Auto pro-rate</span> : `${formatCurrency(p.perAbsentDeduction)}/day`}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{p ? p.paidLeavesPerMonth : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{p ? `${p.defaultCommissionRate}%` : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {!p ? (
                          <span className="text-xs text-gray-400">Not set</span>
                        ) : p.active ? (
                          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">On</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Off</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setEditing(m)}
                          title="Edit payroll"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil size={13} /> {p ? 'Edit' : 'Set up'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PayrollProfileModal
        isOpen={editing !== null}
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); fetchMembers(); }}
      />
    </div>
  );
}
