'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, ChevronLeft, ChevronRight, ArrowLeft, Download, Lock, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { useToast } from '@/components/common/Toast';
import { formatCurrency } from '@/lib/utils';
import { downloadPayslipPdf, type PayslipDoc } from '@/lib/payslip-pdf';

interface Row {
  id: string; employeeName: string; designation: string | null; slipNo: string | null;
  baseSalary: number; commissionTotal: number; absenceDeduction: number;
  grossEarnings: number; netPay: number; status: string;
}

function currentPeriod(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
}
function shiftPeriod(p: string, d: number): string {
  const [y, m] = p.split('-').map(Number);
  const dt = new Date(y, m - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export default function PayslipsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canPayroll = useFeature('feature.payroll');
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const { addToast } = useToast();

  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [period]);

  const fetchRows = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/payroll/payslips?period=${period}`, { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load');
      setRows(j.payslips ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdmin || !canPayroll) return;
    fetchRows();
  }, [authLoading, user?.id, isAdmin, canPayroll, fetchRows]);

  async function generate() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/payroll/payslips/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Generate failed');
      addToast({ type: 'success', message: `Generated ${j.generated} payslip${j.generated !== 1 ? 's' : ''}${j.skipped ? `, ${j.skipped} finalized skipped` : ''}.` });
      await fetchRows();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finalize(id: string) {
    try {
      const res = await fetch(`/api/payroll/payslips/${id}/finalize`, { method: 'POST', credentials: 'include' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Finalize failed');
      addToast({ type: 'success', message: 'Payslip finalized.' });
      fetchRows();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function download(id: string) {
    try {
      const res = await fetch(`/api/payroll/payslips/${id}`, { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load payslip');
      await downloadPayslipPdf(j.payslip as PayslipDoc);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (authLoading) return <div className="py-16"><Loader size="lg" message="Loading..." /></div>;
  if (!isAdmin) return <div className="py-16 text-center text-gray-500 text-sm">Payslips are managed by your admin.</div>;
  if (!canPayroll) return <FeatureLocked feature="feature.payroll" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link href="/dashboard/payroll" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mb-1">
            <ArrowLeft size={13} /> Payroll
          </Link>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
            <FileText size={24} className="text-blue-600" /> Payslips
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generate} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60">
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? 'Generating…' : 'Generate'}
          </button>
          <button onClick={() => setPeriod((p) => shiftPeriod(p, -1))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={() => setPeriod((p) => shiftPeriod(p, 1))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><ChevronRight size={16} /></button>
        </div>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12"><Loader message="Loading payslips..." /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No payslips for {monthLabel}. Click <span className="font-semibold">Generate</span> to create drafts for everyone on payroll.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Slip No.</th>
                  <th className="px-4 py-3 text-right">Base</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Absence</th>
                  <th className="px-4 py-3 text-right">Net pay</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{r.employeeName}</p>
                      {r.designation && <p className="text-xs text-gray-500">{r.designation}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.slipNo || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(r.baseSalary)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(r.commissionTotal)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{r.absenceDeduction ? `− ${formatCurrency(r.absenceDeduction)}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(r.netPay)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.status === 'Draft'
                        ? <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Draft</span>
                        : <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{r.status}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {r.status === 'Draft' && (
                          <button onClick={() => finalize(r.id)} title="Finalize (lock)" className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 rounded-lg">
                            <Lock size={13} /> Finalize
                          </button>
                        )}
                        <button onClick={() => download(r.id)} title="Download PDF" className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Download size={13} /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Generate builds Drafts (base + commission − absence). Finalized payslips are locked snapshots members can download. Re-generating never touches a finalized slip.
      </p>
    </div>
  );
}
