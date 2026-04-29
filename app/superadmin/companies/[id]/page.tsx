'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, Pause, Save, ShieldCheck } from 'lucide-react';

interface UserRow {
  id: string; name: string; email: string; phone: string; role: string;
  status: string; emailVerified: string | null; createdAt: string;
}
interface PaymentRow {
  id: string; amount: number; paidOn: string;
  coversFrom: string; coversUntil: string;
  method: string; reference: string | null; notes: string | null;
}
interface Company {
  id: string; companyName: string; plan: string; status: string;
  seatLimit: number; monthlyFee: number | null;
  subscriptionUntil: string | null; subscriptionExpiry: string | null;
  notes: string | null; createdAt: string;
  users: UserRow[];
  paymentRecords: PaymentRow[];
}
interface Stats {
  activeClients: number; activeProperties: number; totalCommissions: number;
  totalCommissionAmount: number; totalDealVolume: number;
  teamMembers: number; admins: number; seatsUsed: number; seatsLimit: number;
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<{ company: Company; stats: Stats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // edit form state
  const [edit, setEdit] = useState({
    plan: '', seatLimit: 0, monthlyFee: '', subscriptionUntil: '', status: '', notes: '',
  });

  function load() {
    fetch(`/api/superadmin/companies/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setData(j);
        setEdit({
          plan: j.company.plan,
          seatLimit: j.company.seatLimit,
          monthlyFee: j.company.monthlyFee?.toString() ?? '',
          subscriptionUntil: j.company.subscriptionUntil
            ? new Date(j.company.subscriptionUntil).toISOString().slice(0, 10)
            : '',
          status: j.company.status,
          notes: j.company.notes ?? '',
        });
      })
      .catch((e) => setError(String(e)));
  }
  useEffect(load, [id]);

  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!data) return <div className="text-gray-500">Loading…</div>;
  const { company, stats } = data;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: edit.plan,
          seatLimit: Number(edit.seatLimit),
          monthlyFee: edit.monthlyFee ? Number(edit.monthlyFee) : null,
          subscriptionUntil: edit.subscriptionUntil,
          status: edit.status,
          notes: edit.notes || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Save failed');
      setEditing(false);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!confirm('Reset the broker admin password? Their current sessions will be terminated immediately.')) return;
    const res = await fetch(`/api/superadmin/companies/${id}/reset-password`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error ?? 'Reset failed');
      return;
    }
    setResetMsg(j.tempPassword);
  }

  async function suspend() {
    if (!confirm(`Suspend ${company.companyName}? All users will be logged out. Data is preserved and recoverable.`)) return;
    const res = await fetch(`/api/superadmin/companies/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error ?? 'Suspend failed');
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/superadmin/companies" className="text-sm text-blue-600 hover:underline">
          ← Back to companies
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.companyName}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Onboarded {new Date(company.createdAt).toLocaleDateString()} · Plan: <span className="capitalize">{company.plan}</span> · Status: <span className="capitalize">{company.status}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/superadmin/companies/${id}/features`}
              className="flex items-center gap-2 px-3 py-2 border border-violet-300 text-violet-700 bg-violet-50 rounded text-sm hover:bg-violet-100"
            >
              <ShieldCheck className="w-4 h-4" />
              Manage features
            </Link>
            <button onClick={resetPassword} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
              <KeyRound className="w-4 h-4" />
              Reset admin password
            </button>
            {company.status !== 'suspended' && (
              <button onClick={suspend} className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50">
                <Pause className="w-4 h-4" />
                Suspend
              </button>
            )}
            <button
              onClick={() => router.push(`/superadmin/payments?companyId=${id}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >
              + Record payment
            </button>
          </div>
        </div>
      </div>

      {resetMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">New temporary password (shown only once):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded font-mono text-sm border border-amber-200">{resetMsg}</code>
            <button
              onClick={() => navigator.clipboard.writeText(resetMsg)}
              className="px-3 py-2 bg-gray-900 text-white rounded text-sm flex items-center gap-1"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Seats used" value={`${stats.seatsUsed} / ${stats.seatsLimit}`} />
        <Stat label="Active leads" value={stats.activeClients.toString()} />
        <Stat label="Active inventory" value={stats.activeProperties.toString()} />
        <Stat label="Commission booked" value={`₹${stats.totalCommissionAmount.toLocaleString('en-IN')}`} />
      </div>

      {/* Edit / settings */}
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Subscription & limits</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:underline">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); load(); }} className="text-sm text-gray-600">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm">
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
        {!editing ? (
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Row label="Plan" value={company.plan} />
            <Row label="Seat limit" value={String(company.seatLimit)} />
            <Row label="Monthly fee" value={company.monthlyFee ? `₹${company.monthlyFee.toLocaleString('en-IN')}` : '—'} />
            <Row label="Status" value={company.status} />
            <Row label="Subscription until" value={company.subscriptionUntil ? new Date(company.subscriptionUntil).toLocaleDateString() : '—'} />
            <Row label="Notes" value={company.notes ?? '—'} />
          </dl>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField label="Plan" value={edit.plan} onChange={(v) => setEdit({ ...edit, plan: v })} options={['standard','pro','enterprise','custom']} />
            <NumberField label="Seat limit" value={String(edit.seatLimit)} onChange={(v) => setEdit({ ...edit, seatLimit: Number(v) })} />
            <NumberField label="Monthly fee (₹)" value={edit.monthlyFee} onChange={(v) => setEdit({ ...edit, monthlyFee: v })} />
            <SelectField label="Status" value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={['active','suspended','expired']} />
            <DateField label="Subscription until" value={edit.subscriptionUntil} onChange={(v) => setEdit({ ...edit, subscriptionUntil: v })} />
            <TextareaField label="Notes" value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} />
          </div>
        )}
      </section>

      {/* Team */}
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Team ({company.users.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {company.users.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-6 py-3 text-gray-600">{u.email}</td>
                <td className="px-6 py-3 capitalize text-gray-600">{u.role}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded border ${u.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {company.users.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Payments */}
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent payments ({company.paymentRecords.length})</h2>
          <Link href={`/superadmin/payments?companyId=${id}`} className="text-sm text-blue-600 hover:underline">
            View all →
          </Link>
        </div>
        {company.paymentRecords.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            No payments recorded yet.{' '}
            <Link href={`/superadmin/payments?companyId=${id}`} className="text-blue-600 hover:underline">
              Record first payment →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Method</th>
                <th className="px-6 py-3 font-medium">Covers</th>
                <th className="px-6 py-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {company.paymentRecords.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-3 text-gray-600">{new Date(p.paidOn).toLocaleDateString()}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">₹{p.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-3 capitalize text-gray-600">{p.method.replace('_', ' ')}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(p.coversFrom).toLocaleDateString()} → {new Date(p.coversUntil).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-gray-500">{p.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-900 mt-1">{value}</dd>
    </div>
  );
}
function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </label>
  );
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </label>
  );
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm capitalize">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block md:col-span-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </label>
  );
}
