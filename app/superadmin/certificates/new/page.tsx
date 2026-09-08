'use client';

/**
 * SuperAdmin → Issue a new Broker365 internship certificate. Collects the
 * intern details, posts to /api/superadmin/certificates, then AUTO-SHOWS the
 * finished, professionally-designed certificate (with QR) right on the page —
 * ready to download or share.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2 } from 'lucide-react';
import { CertificatePreviewPanel } from '@/components/certificates/CertificatePreviewPanel';
import type { PublicCertificate } from '@/lib/certificates';
import { TEAMS, OTHER_TEAM } from '@/lib/certificate-options';

interface CreateResult {
  certificate: PublicCertificate & { id: string };
  verifyUrl: string;
}

export default function NewCertificatePage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  const [form, setForm] = useState({
    internName: '',
    role: '',
    team: 'Sales',
    customTeam: '',
    startDate: '',
    endDate: '',
    issueDate: today(),
    performance: '',
    // Optional student details
    fatherName: '',
    rollNumber: '',
    collegeName: '',
    course: '',
    semester: '',
    signatoryName: '',
    signatoryTitle: '',
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const usingOther = form.team === OTHER_TEAM;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const team = usingOther ? form.customTeam.trim() : form.team;
      if (!team) throw new Error('Please enter the team name');

      const res = await fetch('/api/superadmin/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internName: form.internName,
          role: form.role,
          team,
          startDate: form.startDate,
          endDate: form.endDate,
          issueDate: form.issueDate || undefined,
          performance: form.performance || undefined,
          fatherName: form.fatherName || undefined,
          rollNumber: form.rollNumber || undefined,
          collegeName: form.collegeName || undefined,
          course: form.course || undefined,
          semester: form.semester || undefined,
          signatoryName: form.signatoryName || undefined,
          signatoryTitle: form.signatoryTitle || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed to issue certificate');
      setResult(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Auto-show the finished certificate after issuing ──
  if (result) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-start">
          <CheckCircle2 className="mt-0.5 hidden h-6 w-6 shrink-0 text-green-600 sm:block" />
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600 sm:hidden" />
              Certificate issued
            </h2>
            <p className="mt-0.5 text-sm text-green-800">
              <strong>{result.certificate.internName}</strong>&apos;s certificate is live —
              download or share it below.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => {
                setResult(null);
                setForm((f) => ({ ...f, internName: '', role: '', performance: '' }));
              }}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Issue another
            </button>
            <Link
              href="/superadmin/certificates"
              className="rounded bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              All certificates
            </Link>
          </div>
        </div>

        <CertificatePreviewPanel cert={result.certificate} verifyUrl={result.verifyUrl} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/superadmin/certificates" className="text-sm text-blue-600 hover:underline">
          ← Back to certificates
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Award className="h-6 w-6 text-amber-500" />
          Issue internship certificate
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter the intern&apos;s details. The professional Broker365 certificate and a scannable
          verification QR code are generated automatically.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Intern</h2>
          <Input label="Intern full name" value={form.internName} onChange={(v) => update('internName', v)} required placeholder="e.g. Aarav Sharma" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Position / role" value={form.role} onChange={(v) => update('role', v)} required placeholder="e.g. Sales Intern" />
            <div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Team <span className="text-red-500">*</span></span>
                <select
                  value={form.team}
                  onChange={(e) => update('team', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              {usingOther && (
                <input
                  value={form.customTeam}
                  onChange={(e) => update('customTeam', e.target.value)}
                  placeholder="Enter team name"
                  required
                  className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Start date" type="date" value={form.startDate} onChange={(v) => update('startDate', v)} required />
            <Input label="End date" type="date" value={form.endDate} onChange={(v) => update('endDate', v)} required />
            <Input label="Issue date" type="date" value={form.issueDate} onChange={(v) => update('issueDate', v)} />
          </div>
          <Textarea
            label="Performance remark (optional)"
            value={form.performance}
            onChange={(v) => update('performance', v)}
            placeholder="e.g. Consistently exceeded targets and mentored new joiners."
          />
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Student details (optional)</h2>
          <p className="-mt-2 text-xs text-gray-500">
            For interns who are college students. Shown as a details block on the certificate; leave blank to hide.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Father's name" value={form.fatherName} onChange={(v) => update('fatherName', v)} placeholder="e.g. Rajendra Singh" />
            <Input label="Roll number" value={form.rollNumber} onChange={(v) => update('rollNumber', v)} placeholder="e.g. 5936514" />
          </div>
          <Input label="College / University name" value={form.collegeName} onChange={(v) => update('collegeName', v)} placeholder="e.g. Shri Mahaveer College" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Course" value={form.course} onChange={(v) => update('course', v)} placeholder="e.g. BA" />
            <Input label="Semester" value={form.semester} onChange={(v) => update('semester', v)} placeholder="e.g. 5th" />
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Signatory (optional)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Signatory name" value={form.signatoryName} onChange={(v) => update('signatoryName', v)} placeholder="e.g. Priya Verma" />
            <Input label="Signatory title" value={form.signatoryTitle} onChange={(v) => update('signatoryTitle', v)} placeholder="e.g. Head of Sales" />
          </div>
        </section>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Link href="/superadmin/certificates" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Issuing…' : 'Issue certificate'}
          </button>
        </div>
      </form>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Input({
  label, value, onChange, type = 'text', required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function Textarea({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}
