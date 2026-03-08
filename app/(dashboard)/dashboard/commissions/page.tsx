'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Loader from '@/components/common/Loader';
import Alert from '@/components/common/Alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/ Modal';
import Input from '@/components/common/ Input';
import { IndianRupee, Clock, CheckCircle2, TrendingUp, ChevronRight } from 'lucide-react';

interface Commission {
  id: string;
  clientId: string;
  client: { clientName: string };
  user: { name: string };
  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidStatus: string;
  createdAt: string;
}

// ── Custom tooltip ──
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-800">
          ₹{Number(payload[0]?.value).toLocaleString('en-IN')}
        </p>
      </div>
    );
  }
  return null;
};

// ── Stat card ──
const StatCard = ({
  label, value, color, icon: Icon, sub,
}: {
  label: string;
  value: string;
  color: string;
  icon: any;
  sub?: string;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
    </div>
    <p className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color }}>
      {value}
    </p>
    {sub && <p className="text-xs text-gray-400">{sub}</p>}
  </div>
);

// ── Status badge ──
const StatusBadge = ({ status }: { status: string }) => {
  const isPaid = status === 'Paid';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
      ${isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {status}
    </span>
  );
};

type FilterType = 'all' | 'pending' | 'paid';

export default function CommissionsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ totalCommission: 0, pendingCommission: 0 });
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    fetchCommissions();
  }, [filter, page]);

  const fetchCommissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParam = filter === 'all' ? '' : filter;
      const response = await fetch(
        `/api/commissions?paidStatus=${filterParam}&page=${page}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch commissions');
      const data = await response.json();
      setCommissions(data.commissions);
      setTotals(data.totals);
      setTotalPages(data.pagination?.pages || Math.ceil((data.commissions?.length || 0) / 10));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    setMarkingPaid(true);
    try {
      const response = await fetch(`/api/commissions/${commissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidStatus: 'Paid' }),
      });
      if (!response.ok) throw new Error('Failed to update');
      addToast({ type: 'success', message: 'Commission marked as paid' });
      fetchCommissions();
      setIsModalOpen(false);
    } catch (err) {
      addToast({ type: 'error', message: String(err) });
    } finally {
      setMarkingPaid(false);
    }
  };

  const paidAmount = totals.totalCommission - totals.pendingCommission;
  const chartData = [
    { status: 'Pending', amount: totals.pendingCommission },
    { status: 'Paid',    amount: paidAmount },
  ];

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid',    label: 'Paid' },
  ];

  return (
    <div className="py-6 sm:py-8 space-y-5 px-2 sm:px-0">

      {/* ── HEADER ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Commissions
        </h1>
        <p className="text-gray-500 text-sm mt-1">Track all your earnings</p>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
      )}

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total Commission"
          value={`₹${totals.totalCommission.toLocaleString('en-IN')}`}
          color="#3b82f6"
          icon={TrendingUp}
          sub="All time earnings"
        />
        <StatCard
          label="Pending Amount"
          value={`₹${totals.pendingCommission.toLocaleString('en-IN')}`}
          color="#f59e0b"
          icon={Clock}
          sub="Awaiting payment"
        />
        <StatCard
          label="Paid Amount"
          value={`₹${paidAmount.toLocaleString('en-IN')}`}
          color="#10b981"
          icon={CheckCircle2}
          sub="Successfully collected"
        />
      </div>

      {/* ── CHART ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-800">Commission Overview</h3>
          <p className="text-xs text-gray-400 mt-0.5">Pending vs Paid breakdown</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="40%"
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="amount" name="Amount (₹)" radius={[6, 6, 0, 0]}
              fill="#3b82f6"
              label={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── TABLE SECTION ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Table header + filters */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row
          sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Commission Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {commissions.length} record{commissions.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl w-fit">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all
                  ${filter === key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table body */}
        {loading ? (
          <div className="py-16">
            <Loader size="md" message="Loading commissions..." />
          </div>
        ) : commissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <IndianRupee size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No commissions found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Client', 'Sales Person', 'Deal Amount', 'Commission %', 'Amount', 'Status', 'Action'].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                        ${['Deal Amount', 'Commission %', 'Amount'].includes(h) ? 'text-right' : 'text-left'}
                        ${['Status', 'Action'].includes(h) ? 'text-center' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-800">
                        {c.client.clientName}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-600">
                        {c.user.name}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-right text-gray-700">
                        ₹{c.dealAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-right text-gray-700">
                        {c.commissionPercentage}%
                      </td>
                      <td className="px-4 py-3.5 text-sm text-right font-bold text-gray-900">
                        ₹{c.commissionAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={c.paidStatus} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {c.paidStatus === 'Pending' && (
                          <button
                            onClick={() => { setSelectedCommission(c); setIsModalOpen(true); }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700
                              border border-blue-200 bg-blue-50 hover:bg-blue-100
                              px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {commissions.map((c) => (
                <div key={c.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{c.client.clientName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.user.name}</p>
                    </div>
                    <StatusBadge status={c.paidStatus} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-xs text-gray-400">Deal</p>
                      <p className="text-xs font-bold text-gray-700 mt-0.5">
                        ₹{c.dealAmount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-xs text-gray-400">Rate</p>
                      <p className="text-xs font-bold text-gray-700 mt-0.5">
                        {c.commissionPercentage}%
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-2.5">
                      <p className="text-xs text-emerald-500">Earned</p>
                      <p className="text-xs font-bold text-emerald-700 mt-0.5">
                        ₹{c.commissionAmount.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {c.paidStatus === 'Pending' && (
                    <button
                      onClick={() => { setSelectedCommission(c); setIsModalOpen(true); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold
                        text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100
                        rounded-xl transition-colors"
                    >
                      Mark as Paid <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  isLoading={loading}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MARK AS PAID MODAL ── */}
      {selectedCommission && (
        <Modal
          isOpen={isModalOpen}
          title="Mark Commission as Paid"
          onClose={() => setIsModalOpen(false)}
          onSubmit={() => handleMarkAsPaid(selectedCommission.id)}
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400 font-medium">Client</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {selectedCommission.client.clientName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Sales Person</p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">
                  {selectedCommission.user.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Commission Amount</p>
                <p className="text-2xl font-bold text-emerald-600 mt-0.5">
                  ₹{selectedCommission.commissionAmount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <Input
              label="Payment Reference (Optional)"
              placeholder="Cheque no., Transaction ID, etc."
            />
          </div>
        </Modal>
      )}
    </div>
  );
}