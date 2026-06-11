'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { formatCurrency } from '@/lib/utils';
import { downloadPayslipPdf, type PayslipDoc } from '@/lib/payslip-pdf';

interface Row { id: string; period: string; slipNo: string | null; netPay: number; status: string; finalizedAt: string | null }

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** Member view of their own finalized salary slips, with PDF download. */
export default function MySalaryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canPayroll = useFeature('feature.payroll');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/payroll/payslips/me', { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load');
      setRows(j.payslips ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user?.id || !canPayroll) return;
    fetchRows();
  }, [authLoading, user?.id, canPayroll, fetchRows]);

  async function download(id: string) {
    setDownloading(id);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/payslips/${id}`, { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load payslip');
      await downloadPayslipPdf(j.payslip as PayslipDoc);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(null);
    }
  }

  if (authLoading) return <div className="py-16"><Loader size="lg" message="Loading..." /></div>;
  if (!canPayroll) return <FeatureLocked feature="feature.payroll" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
          <Wallet size={24} className="text-blue-600" /> My Salary
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Download your monthly salary slips</p>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12"><Loader message="Loading..." /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No salary slips yet. They appear here once your admin finalizes them.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4">
                <div>
                  <p className="font-semibold text-gray-900">{monthLabel(r.period)}</p>
                  <p className="text-xs text-gray-500">
                    {r.slipNo ? `${r.slipNo} · ` : ''}Net {formatCurrency(r.netPay)}
                  </p>
                </div>
                <button
                  onClick={() => download(r.id)}
                  disabled={downloading === r.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Download size={15} /> {downloading === r.id ? 'Preparing…' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
