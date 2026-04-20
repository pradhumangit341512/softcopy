'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Company { id: string; companyName: string }
interface Payment {
  id: string; amount: number; paidOn: string;
  coversFrom: string; coversUntil: string;
  method: string; reference: string | null; notes: string | null;
  company: Company;
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
      <PaymentsInner />
    </Suspense>
  );
}

function PaymentsInner() {
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get('companyId') ?? '';
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [filterCompanyId, setFilterCompanyId] = useState(initialCompanyId);
  const [showForm, setShowForm] = useState(initialCompanyId !== '');
  const [error, setError] = useState<string | null>(null);

  function loadPayments(companyId: string) {
    const qs = companyId ? `?companyId=${companyId}` : '';
    fetch(`/api/superadmin/payments${qs}`)
      .then((r) => r.json())
      .then((j) => {
        setPayments(j.payments ?? []);
        setTotalAmount(j.totals?.totalAmount ?? 0);
      })
      .catch((e) => setError(String(e)));
  }

  useEffect(() => {
    loadPayments(filterCompanyId);
  }, [filterCompanyId]);

  useEffect(() => {
    fetch('/api/superadmin/companies')
      .then((r) => r.json())
      .then((j) => setCompanies(j.companies?.map((c: Company) => ({ id: c.id, companyName: c.companyName })) ?? []))
      .catch(() => {});
  }, []);

  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Payment ledger</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {showForm ? 'Hide form' : '+ Record payment'}
        </button>
      </div>

      {showForm && (
        <RecordPaymentForm
          companies={companies}
          defaultCompanyId={initialCompanyId}
          onCreated={() => {
            loadPayments(filterCompanyId);
            setShowForm(false);
          }}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Filter by company:</label>
          <select
            value={filterCompanyId}
            onChange={(e) => setFilterCompanyId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-gray-700">
          Total: <span className="font-bold">₹{totalAmount.toLocaleString('en-IN')}</span>
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Covers</th>
              <th className="px-4 py-3 font-medium">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments?.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{new Date(p.paidOn).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">
                  <Link href={`/superadmin/companies/${p.company.id}`} className="hover:text-blue-600">
                    {p.company.companyName}
                  </Link>
                </td>
                <td className="px-4 py-3 font-bold text-gray-900">₹{p.amount.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{p.method.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(p.coversFrom).toLocaleDateString()} → {new Date(p.coversUntil).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.reference ?? '—'}</td>
              </tr>
            ))}
            {payments && payments.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No payments recorded yet.</td></tr>
            )}
            {!payments && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordPaymentForm({
  companies, defaultCompanyId, onCreated,
}: {
  companies: Company[]; defaultCompanyId: string; onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const oneMonthFromToday = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
  })();

  const [form, setForm] = useState({
    companyId: defaultCompanyId,
    amount: '',
    paidOn: today,
    coversFrom: today,
    coversUntil: oneMonthFromToday,
    method: 'bank_transfer' as 'bank_transfer'|'razorpay_link'|'cash'|'cheque'|'upi'|'other',
    reference: '',
    notes: '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: form.companyId,
          amount: Number(form.amount),
          paidOn: form.paidOn,
          coversFrom: form.coversFrom,
          coversUntil: form.coversUntil,
          method: form.method,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Record a payment</h2>
      <p className="text-xs text-gray-500 -mt-2">
        Recording a payment automatically extends the company&apos;s subscription window
        to the &ldquo;covers until&rdquo; date.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Company *</span>
          <select required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Select…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Amount (₹) *</span>
          <input type="number" required min={1} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Paid on *</span>
          <input type="date" required value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Method *</span>
          <select required value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as typeof form.method })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="bank_transfer">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="razorpay_link">Razorpay link</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Covers from *</span>
          <input type="date" required value={form.coversFrom} onChange={(e) => setForm({ ...form, coversFrom: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Covers until *</span>
          <input type="date" required value={form.coversUntil} onChange={(e) => setForm({ ...form, coversUntil: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Reference (txn id, cheque no, etc.)</span>
          <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium">
          {submitting ? 'Saving…' : 'Save payment'}
        </button>
      </div>
    </form>
  );
}
