'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import Loader from '@/components/common/Loader';
import Alert from '@/components/common/Alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Pagination from '@/components/common/Pagination';
import {
  IndianRupee, Clock, CheckCircle2, TrendingUp,
  ChevronRight, Plus, FileSpreadsheet,
  FileText, Pencil, X, Target,
  Search, Wallet,
} from 'lucide-react';
import Button from '@/components/common/ Button';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface Commission {
  id: string;
  clientId: string;
  client: { clientName: string };
  user?: { name: string } | null;
  salesPersonName?: string | null;
  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidStatus: string;
  createdAt: string;
  paymentReference?: string;
}

interface Client { id: string; clientName: string; }

interface MonthlyBudget {
  id?: string;
  month: string;
  targetAmount: number;
}

type FilterType = 'all' | 'Pending' | 'Paid';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN')}`;

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getSalesPerson = (c: Commission) =>
  c.salesPersonName || c.user?.name || '—';

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────
const StatCard = ({
  label, value, color, icon: Icon, sub,
}: { label: string; value: string; color: string; icon: any; sub?: string }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-xs sm:text-sm font-medium text-gray-500">{label}</span>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
    </div>
    <p className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight" style={{ color }}>
      {value}
    </p>
    {sub && <p className="text-xs text-gray-400">{sub}</p>}
  </div>
);

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-800">{fmt(Number(payload[0]?.value))}</p>
      </div>
    );
  }
  return null;
};

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────
export default function CommissionsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // ── Data state ──
  const [commissions, setCommissions]   = useState<Commission[]>([]);
  const [clients, setClients]           = useState<Client[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [totals, setTotals]             = useState({ totalCommission: 0, pendingCommission: 0 });
  const [filter, setFilter]             = useState<FilterType>('all');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);

  // ── Monthly budget state ──
  const [budget, setBudget]               = useState<MonthlyBudget>({ month: currentMonthKey(), targetAmount: 0 });
  const [budgetInput, setBudgetInput]     = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [savingBudget, setSavingBudget]   = useState(false);

  // ── Modal state ──
  type ModalMode = 'add' | 'edit' | 'markPaid' | null;
  const [modalMode, setModalMode]         = useState<ModalMode>(null);
  const [selectedCommission, setSelected] = useState<Commission | null>(null);
  const [submitting, setSubmitting]       = useState(false);

  // ── Form state ──
  const emptyForm = {
    clientId: '',
    salesPersonName: '',       // free text, optional
    dealAmount: '',
    commissionPercentage: '5',
    paidStatus: 'Pending',
    paymentReference: '',
  };
  const [form, setForm] = useState(emptyForm);

  const closeModal = () => { setModalMode(null); setSelected(null); setForm(emptyForm); };

  // ─── Fetch commissions ───
  const fetchCommissions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(filter !== 'all' && { paidStatus: filter }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/commissions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCommissions(data.commissions || []);
      setTotals(data.totals || { totalCommission: 0, pendingCommission: 0 });
      setTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  // ─── Fetch clients for dropdown ───
  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?limit=200', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setClients(d.clients || []); }
    } catch {}
  };

  // ─── Fetch monthly budget ───
  const fetchBudget = async () => {
    try {
      const res = await fetch(`/api/budget?month=${currentMonthKey()}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        if (d.budget) { setBudget(d.budget); setBudgetInput(String(d.budget.targetAmount)); }
      }
    } catch {}
  };

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);
  useEffect(() => { fetchClients(); fetchBudget(); }, []);

  // ─── Save budget ───
  const saveBudget = async () => {
    setSavingBudget(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ month: currentMonthKey(), targetAmount: Number(budgetInput) }),
      });
      if (!res.ok) throw new Error('Failed to save budget');
      const d = await res.json();
      setBudget(d.budget);
      setEditingBudget(false);
      addToast({ type: 'success', message: 'Budget target saved' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSavingBudget(false);
    }
  };

  // ─── Add commission ───
  const handleAdd = async () => {
    if (!form.clientId) {
      addToast({ type: 'error', message: 'Client is required' });
      return;
    }
    if (!form.dealAmount) {
      addToast({ type: 'error', message: 'Deal Amount is required' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId:            form.clientId,
          salesPersonName:     form.salesPersonName?.trim() || null,
          dealAmount:          Number(form.dealAmount),
          commissionPercentage: Number(form.commissionPercentage),
          paidStatus:          form.paidStatus,
          paymentReference:    form.paymentReference || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      addToast({ type: 'success', message: 'Commission added successfully' });
      closeModal();
      fetchCommissions();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Edit commission ───
  const openEdit = (c: Commission) => {
    setSelected(c);
    setForm({
      clientId:            c.clientId,
      salesPersonName:     c.salesPersonName || '',
      dealAmount:          String(c.dealAmount),
      commissionPercentage: String(c.commissionPercentage),
      paidStatus:          c.paidStatus,
      paymentReference:    c.paymentReference || '',
    });
    setModalMode('edit');
  };

  const handleEdit = async () => {
    if (!selectedCommission) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/commissions/${selectedCommission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          salesPersonName:     form.salesPersonName?.trim() || null,
          dealAmount:          Number(form.dealAmount),
          commissionPercentage: Number(form.commissionPercentage),
          paidStatus:          form.paidStatus,
          paymentReference:    form.paymentReference || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      addToast({ type: 'success', message: 'Commission updated' });
      closeModal();
      fetchCommissions();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Mark as paid ───
  const handleMarkPaid = async () => {
    if (!selectedCommission) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/commissions/${selectedCommission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paidStatus: 'Paid', paymentReference: form.paymentReference }),
      });
      if (!res.ok) throw new Error('Failed');
      addToast({ type: 'success', message: 'Commission marked as paid' });
      closeModal();
      fetchCommissions();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Export PDF ───
  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Commissions Report', 14, 18);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 26);
      doc.text(`Total: ${fmt(totals.totalCommission)}  |  Pending: ${fmt(totals.pendingCommission)}  |  Paid: ${fmt(totals.totalCommission - totals.pendingCommission)}`, 14, 33);

      autoTable(doc, {
        startY: 40,
        head: [['Client', 'Sales Person', 'Deal Amount', 'Commission %', 'Amount', 'Status', 'Date']],
        body: commissions.map(c => [
          c.client.clientName,
          getSalesPerson(c),
          fmt(c.dealAmount),
          `${c.commissionPercentage}%`,
          fmt(c.commissionAmount),
          c.paidStatus,
          new Date(c.createdAt).toLocaleDateString('en-IN'),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save(`commissions-${currentMonthKey()}.pdf`);
      addToast({ type: 'success', message: 'PDF downloaded' });
    } catch {
      addToast({ type: 'error', message: 'PDF export failed. Make sure jspdf is installed.' });
    }
  };

  // ─── Export Excel ───
  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = commissions.map(c => ({
        Client:                  c.client.clientName,
        'Sales Person':          getSalesPerson(c),
        'Deal Amount (₹)':       c.dealAmount,
        'Commission %':          c.commissionPercentage,
        'Commission Amount (₹)': c.commissionAmount,
        Status:                  c.paidStatus,
        'Payment Ref':           c.paymentReference || '',
        Date:                    new Date(c.createdAt).toLocaleDateString('en-IN'),
      }));

      const summary = [
        { Metric: 'Total Commission',    Value: totals.totalCommission },
        { Metric: 'Pending Commission',  Value: totals.pendingCommission },
        { Metric: 'Paid Commission',     Value: totals.totalCommission - totals.pendingCommission },
        { Metric: 'Monthly Budget Target', Value: budget.targetAmount },
      ];

      const wb  = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(rows);
      const ws2 = XLSX.utils.json_to_sheet(summary);
      ws1['!cols'] = [
        { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Commissions');
      XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
      XLSX.writeFile(wb, `commissions-${currentMonthKey()}.xlsx`);
      addToast({ type: 'success', message: 'Excel downloaded' });
    } catch {
      addToast({ type: 'error', message: 'Excel export failed. Make sure xlsx is installed.' });
    }
  };

  // ─── Derived values ───
  const paidAmount      = totals.totalCommission - totals.pendingCommission;
  const budgetProgress  = budget.targetAmount > 0
    ? Math.min(Math.round((totals.totalCommission / budget.targetAmount) * 100), 100)
    : 0;
  const budgetRemaining = Math.max(budget.targetAmount - totals.totalCommission, 0);

  const chartData = [
    { status: 'Pending', amount: totals.pendingCommission },
    { status: 'Paid',    amount: paidAmount },
    ...(budget.targetAmount > 0 ? [{ status: 'Target', amount: budget.targetAmount }] : []),
  ];

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',     label: 'All'     },
    { key: 'Pending', label: 'Pending' },
    { key: 'Paid',    label: 'Paid'    },
  ];

  const computedCommission = form.dealAmount && form.commissionPercentage
    ? (Number(form.dealAmount) * Number(form.commissionPercentage)) / 100
    : 0;

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5 px-2 sm:px-4 lg:px-0">

      {/* ══ HEADER ══ */}
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
            Commissions
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Track, manage and export all your earnings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl
              hover:bg-emerald-100 transition-colors">
            <FileSpreadsheet size={15} />
            <span className="hidden xs:inline">Excel</span>
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              text-red-700 bg-red-50 border border-red-200 rounded-xl
              hover:bg-red-100 transition-colors">
            <FileText size={15} />
            <span className="hidden xs:inline">PDF</span>
          </button>
          <button onClick={() => setModalMode('add')}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold
              text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors">
            <Plus size={16} />
            <span>Add Payment</span>
          </button>
        </div>
      </div>

      {/* ══ ERROR ══ */}
      {error && <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      {/* ══ STAT CARDS ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Commission" value={fmt(totals.totalCommission)}
          color="#3b82f6" icon={TrendingUp} sub="All time" />
        <StatCard label="Pending Amount" value={fmt(totals.pendingCommission)}
          color="#f59e0b" icon={Clock} sub="Awaiting payment" />
        <StatCard label="Paid Amount" value={fmt(paidAmount)}
          color="#10b981" icon={CheckCircle2} sub="Collected" />
        <StatCard label="Monthly Target" value={fmt(budget.targetAmount)}
          color="#8b5cf6" icon={Target} sub={`${budgetProgress}% achieved`} />
      </div>

      {/* ══ BUDGET + CHART ROW ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Monthly Budget Manager */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Wallet size={15} className="text-purple-500" />
                Monthly Budget
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button onClick={() => setEditingBudget(v => !v)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700
                bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
              {editingBudget ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editingBudget ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input type="number" value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  placeholder="Enter target amount"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-gray-800" />
              </div>
              <button onClick={saveBudget} disabled={savingBudget}
                className="px-3 py-2 text-sm font-semibold text-white bg-blue-600
                  hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60">
                {savingBudget ? '...' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="text-2xl font-bold text-purple-600">
              {fmt(budget.targetAmount)}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span className="font-semibold text-gray-700">{budgetProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700
                  ${budgetProgress >= 100 ? 'bg-emerald-500' :
                    budgetProgress >= 70  ? 'bg-blue-500' :
                    budgetProgress >= 40  ? 'bg-amber-500' : 'bg-red-400'}`}
                style={{ width: `${budgetProgress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-blue-50 rounded-xl p-2.5">
                <p className="text-xs text-blue-500">Achieved</p>
                <p className="text-xs font-bold text-blue-700 mt-0.5">{fmt(totals.totalCommission)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-2.5">
                <p className="text-xs text-orange-500">Remaining</p>
                <p className="text-xs font-bold text-orange-700 mt-0.5">{fmt(budgetRemaining)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Commission Overview</h3>
            <p className="text-xs text-gray-400 mt-0.5">Pending · Paid · Target</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barCategoryGap="35%"
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" name="Amount (₹)" radius={[6, 6, 0, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ══ TABLE SECTION ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100
          flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800">Commission Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {commissions.length} record{commissions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="relative w-full sm:w-52">
            <Search size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search client..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl
                bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                focus:ring-blue-500/20 focus:border-blue-400 text-gray-700" />
          </div>
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl w-fit flex-shrink-0">
            {FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => { setFilter(key); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all
                  ${filter === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table body */}
        {loading ? (
          <div className="py-12 sm:py-16">
            <Loader size="md" message="Loading commissions..." />
          </div>
        ) : commissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <IndianRupee size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No commissions found</p>
            <button onClick={() => setModalMode('add')}
              className="text-xs text-blue-600 hover:underline font-semibold">
              + Add first commission
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Client', 'Sales Person', 'Deal Amount', 'Comm %', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                      <th key={h}
                        className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                          ${['Deal Amount', 'Comm %', 'Amount'].includes(h) ? 'text-right' : 'text-left'}
                          ${['Status', 'Actions'].includes(h) ? 'text-center' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {commissions.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-800">
                        {c.client.clientName}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-600">
                        {getSalesPerson(c)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-right text-gray-700">{fmt(c.dealAmount)}</td>
                      <td className="px-4 py-3.5 text-sm text-right text-gray-700">{c.commissionPercentage}%</td>
                      <td className="px-4 py-3.5 text-sm text-right font-bold text-gray-900">{fmt(c.commissionAmount)}</td>
                      <td className="px-4 py-3.5 text-center"><StatusBadge status={c.paidStatus} /></td>
                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button onClick={() => openEdit(c)}
                            className="w-7 h-7 rounded-lg border border-gray-200 bg-white
                              flex items-center justify-center text-gray-400 hover:text-blue-600
                              hover:border-blue-200 transition-colors">
                            <Pencil size={12} />
                          </Button>
                          {c.paidStatus === 'Pending' && (
                            <button onClick={() => { setSelected(c); setModalMode('markPaid'); }}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700
                                border border-emerald-200 bg-emerald-50 hover:bg-emerald-100
                                px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {commissions.map(c => (
                <div key={c.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{c.client.clientName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{getSalesPerson(c)}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={c.paidStatus} />
                      <p className="text-sm font-bold text-gray-900">{fmt(c.commissionAmount)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-xs text-gray-400">Deal</p>
                      <p className="text-xs font-bold text-gray-700 mt-0.5">{fmt(c.dealAmount)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-xs text-gray-400">Rate</p>
                      <p className="text-xs font-bold text-gray-700 mt-0.5">{c.commissionPercentage}%</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-2.5">
                      <p className="text-xs text-emerald-500">Earned</p>
                      <p className="text-xs font-bold text-emerald-700 mt-0.5">{fmt(c.commissionAmount)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(c)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs
                        font-semibold text-gray-600 border border-gray-200 bg-gray-50
                        hover:bg-gray-100 rounded-xl transition-colors">
                      <Pencil size={11} /> Edit
                    </button>
                    {c.paidStatus === 'Pending' && (
                      <button onClick={() => { setSelected(c); setModalMode('markPaid'); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs
                          font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50
                          hover:bg-emerald-100 rounded-xl transition-colors">
                        Mark Paid <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-100">
                <Pagination currentPage={page} totalPages={totalPages}
                  onPageChange={setPage} isLoading={loading} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════
          ADD / EDIT MODAL
      ══════════════════════════════════ */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center
          justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {modalMode === 'add' ? 'Add New Payment' : 'Edit Commission'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modalMode === 'add' ? 'Record a new commission entry' : 'Update commission details'}
                </p>
              </div>
              <Button onClick={closeModal}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
                  justify-center text-gray-500 transition-colors">
                <X size={16} />
              </Button>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-4">

              {/* Client dropdown — only on Add */}
              {modalMode === 'add' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select value={form.clientId}
                    onChange={e => setForm({ ...form, clientId: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                      bg-white text-gray-800">
                    <option value="">Select client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.clientName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sales Person — free text, optional */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Sales Person
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.salesPersonName}
                  onChange={e => setForm({ ...form, salesPersonName: e.target.value })}
                  placeholder="Enter sales person name..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                    text-gray-800 placeholder:text-gray-400"
                />
              </div>

              {/* Deal Amount + Commission % */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Deal Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input type="number" value={form.dealAmount}
                      onChange={e => setForm({ ...form, dealAmount: e.target.value })}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200
                        rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20
                        focus:border-blue-400 text-gray-800" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Commission %
                  </label>
                  <div className="relative">
                    <input type="number" value={form.commissionPercentage}
                      onChange={e => setForm({ ...form, commissionPercentage: e.target.value })}
                      placeholder="5" min="0" max="100" step="0.5"
                      className="w-full px-3 pr-7 py-2.5 text-sm border border-gray-200
                        rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20
                        focus:border-blue-400 text-gray-800" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>

              {/* Commission preview */}
              {computedCommission > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3
                  flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-600">Commission Amount</span>
                  <span className="text-base font-bold text-emerald-700">{fmt(computedCommission)}</span>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Payment Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Pending', 'Paid'].map(s => (
                    <button key={s} type="button"
                      onClick={() => setForm({ ...form, paidStatus: s })}
                      className={`py-2.5 text-sm font-semibold rounded-xl border transition-all
                        ${form.paidStatus === s
                          ? s === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment reference */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Payment Reference
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="text" value={form.paymentReference}
                  onChange={e => setForm({ ...form, paymentReference: e.target.value })}
                  placeholder="Cheque no., UPI Ref, Transaction ID..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    focus:border-blue-400 text-gray-800 placeholder:text-gray-400" />
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border
                  border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={modalMode === 'add' ? handleAdd : handleEdit} disabled={submitting}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600
                  hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60">
                {submitting ? 'Saving...' : modalMode === 'add' ? 'Add Payment' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          MARK AS PAID MODAL
      ══════════════════════════════════ */}
      {modalMode === 'markPaid' && selectedCommission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center
          justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Mark as Paid</h3>
              <Button onClick={closeModal}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
                  justify-center text-gray-500 transition-colors">
                <X size={16} />
              </Button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Client</span>
                  <span className="font-semibold text-gray-800">
                    {selectedCommission.client.clientName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sales Person</span>
                  <span className="font-semibold text-gray-800">
                    {getSalesPerson(selectedCommission)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Amount</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {fmt(selectedCommission.commissionAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Payment Reference
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="text" value={form.paymentReference}
                  onChange={e => setForm({ ...form, paymentReference: e.target.value })}
                  placeholder="Cheque no., UPI Ref, Transaction ID..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    focus:border-blue-400 text-gray-800" />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeModal}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border
                  border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleMarkPaid} disabled={submitting}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600
                  hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-60">
                {submitting ? 'Saving...' : 'Confirm Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}