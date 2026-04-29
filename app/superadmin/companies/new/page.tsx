'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, CheckCircle2, ShieldCheck } from 'lucide-react';
import { PLANS, PLAN_FEATURES, PLAN_METADATA, FEATURE_LABELS, type Plan } from '@/lib/plans';

interface CreateResult {
  company: { id: string; companyName: string };
  admin: { id: string; email: string; name: string };
  tempPassword: string;
}

export default function NewCompanyPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState<'pwd' | 'all' | null>(null);

  const [form, setForm] = useState({
    companyName: '',
    plan: 'standard' as Plan,
    seatLimit: 5,
    monthlyFee: '',
    subscriptionUntil: defaultExpiry(),
    notes: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    // Leave blank → server auto-generates a memorable temp password (e.g. "Mango-7421")
    // Type a value → server uses YOUR password as the broker's initial password
    adminTempPassword: '',
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          plan: form.plan,
          seatLimit: Number(form.seatLimit),
          monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : null,
          subscriptionUntil: form.subscriptionUntil,
          notes: form.notes || null,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPhone: form.adminPhone,
          // Only send the password field if the user actually typed one,
          // so the server falls back to its generator when blank.
          ...(form.adminTempPassword ? { adminTempPassword: form.adminTempPassword } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed to create company');
      setResult(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const copyAll = () => {
      const text =
        `Welcome to the Broker CRM!\n\n` +
        `Login URL: ${window.location.origin}/login\n` +
        `Email: ${result.admin.email}\n` +
        `Temporary password: ${result.tempPassword}\n\n` +
        `Please log in and change your password immediately.`;
      navigator.clipboard.writeText(text);
      setCopied('all');
      setTimeout(() => setCopied(null), 2000);
    };
    const copyPwd = () => {
      navigator.clipboard.writeText(result.tempPassword);
      setCopied('pwd');
      setTimeout(() => setCopied(null), 2000);
    };

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-green-900">Company created</h2>
              <p className="text-sm text-green-800 mt-1">
                {result.company.companyName} is live. Hand the credentials below to the broker.
                The temporary password is shown only once — copy it now.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <Field label="Login URL" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login`} />
          <Field label="Admin email" value={result.admin.email} />
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Temporary password</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 px-3 py-2 rounded font-mono text-sm">{result.tempPassword}</code>
              <button
                onClick={copyPwd}
                className="px-3 py-2 bg-gray-900 text-white rounded text-sm flex items-center gap-1 hover:bg-gray-700"
              >
                <Copy className="w-4 h-4" />
                {copied === 'pwd' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-amber-700 mt-2">
              ⚠ This password will not be shown again. If lost, use the &ldquo;Reset password&rdquo; action on the company detail page.
            </p>
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button
              onClick={copyAll}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {copied === 'all' ? 'Copied welcome message!' : 'Copy welcome message'}
            </button>
            <button
              onClick={() => router.push(`/superadmin/companies/${result.company.id}`)}
              className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              Open company
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/superadmin/companies" className="text-sm text-blue-600 hover:underline">
          ← Back to companies
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Onboard new broker company</h1>
        <p className="text-gray-600 text-sm mt-1">
          Creates the company, the broker admin login, and a temporary password
          you&apos;ll hand over. Record their first payment separately under Payments.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Company</h2>
          <Input label="Company name" value={form.companyName} onChange={(v) => update('companyName', v)} required />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Plan <span className="text-red-500">*</span>
            </p>
            <PlanPicker
              selected={form.plan}
              onChange={(p) => update('plan', p)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Seat limit"
              type="number"
              value={String(form.seatLimit)}
              onChange={(v) => update('seatLimit', Number(v))}
              min={1}
              max={1000}
              required
            />
            <Input
              label="Monthly fee (₹)"
              type="number"
              value={form.monthlyFee}
              onChange={(v) => update('monthlyFee', v)}
              min={0}
              placeholder="0"
            />
          </div>
          <Input
            label="Subscription valid until"
            type="date"
            value={form.subscriptionUntil}
            onChange={(v) => update('subscriptionUntil', v)}
            required
          />
          <Textarea
            label="Internal notes (not shown to broker)"
            value={form.notes}
            onChange={(v) => update('notes', v)}
            placeholder="Contract terms, contact preferences, special arrangements…"
          />
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Broker admin login</h2>
          <p className="text-xs text-gray-500 -mt-2">
            This is the login YOU&apos;ll hand to the broker. They can later create their own team members up to the seat limit.
          </p>
          <Input label="Admin name" value={form.adminName} onChange={(v) => update('adminName', v)} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Admin email" type="email" value={form.adminEmail} onChange={(v) => update('adminEmail', v)} required />
            <Input label="Admin phone" value={form.adminPhone} onChange={(v) => update('adminPhone', v)} required placeholder="+91…" />
          </div>

          <div>
            <Input
              label="Custom password (optional)"
              type="text"
              value={form.adminTempPassword}
              onChange={(v) => update('adminTempPassword', v)}
              placeholder="Leave blank to auto-generate"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank and we&apos;ll auto-generate a memorable password (e.g.{' '}
              <code className="font-mono">Mango-7421</code>). If you type one, it must
              be 6+ chars with at least one uppercase, lowercase, and number.
            </p>
          </div>
        </section>

        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Link href="/superadmin/companies" className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
          >
            {submitting ? 'Creating…' : 'Create company & admin'}
          </button>
        </div>
      </form>
    </div>
  );
}

function defaultExpiry() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <code className="block bg-gray-100 px-3 py-2 rounded font-mono text-sm text-gray-900">{value}</code>
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', required, placeholder, min, max,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; min?: number; max?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500"> *</span>}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

const PLAN_BORDER: Record<Plan, string> = {
  basic: 'border-emerald-300 bg-emerald-50',
  standard: 'border-sky-300 bg-sky-50',
  pro: 'border-violet-300 bg-violet-50',
  enterprise: 'border-amber-300 bg-amber-50',
};

/**
 * Card-grid plan picker showing tier metadata + the actual feature list each
 * plan unlocks. Reads from lib/plans.ts so the same source-of-truth that
 * drives runtime gating drives the picker — no drift possible.
 */
function PlanPicker({
  selected,
  onChange,
}: {
  selected: Plan;
  onChange: (plan: Plan) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {PLANS.map((p) => {
        const meta = PLAN_METADATA[p];
        const features = PLAN_FEATURES[p];
        const isActive = p === selected;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`text-left p-4 rounded-xl border-2 transition-colors ${
              isActive
                ? `${PLAN_BORDER[p]} ring-2 ring-offset-1 ring-blue-500`
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">{meta.label}</span>
              {isActive && (
                <ShieldCheck className="w-4 h-4 text-blue-600" aria-hidden />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{meta.tagline}</p>
            <p className="text-sm text-gray-700 mt-2">
              ₹{meta.pricePerUserMonth.toLocaleString('en-IN')}
              <span className="text-xs text-gray-500"> / user / month</span>
            </p>
            <p className="text-xs text-gray-500 mt-3 mb-1 uppercase tracking-wide">
              {features.length} features
            </p>
            <ul className="text-[11px] text-gray-600 space-y-0.5 max-h-40 overflow-y-auto">
              {features.map((key) => (
                <li key={key} className="flex items-start gap-1">
                  <span aria-hidden className="text-emerald-500">✓</span>
                  <span className="truncate">{FEATURE_LABELS[key].label}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
