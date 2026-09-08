'use client';

/**
 * SuperAdmin → single certificate. Renders the finished certificate (via the
 * shared preview panel) plus superadmin-only revoke/reinstate controls.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Ban, RotateCcw, Loader2 } from 'lucide-react';
import { CertificatePreviewPanel } from '@/components/certificates/CertificatePreviewPanel';
import type { PublicCertificate } from '@/lib/certificates';

interface CertRow extends PublicCertificate {
  id: string;
}

export default function CertificateViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [cert, setCert] = useState<CertRow | null>(null);
  const [verifyUrl, setVerifyUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/certificates/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed to load certificate');
      setCert(j.certificate);
      setVerifyUrl(j.verifyUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus() {
    if (!cert) return;
    const next = cert.status === 'active' ? 'revoked' : 'active';
    setBusy(true);
    try {
      const res = await fetch(`/api/superadmin/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Update failed');
      setCert((c) => (c ? { ...c, status: next } : c));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? 'Certificate not found'}
        </p>
        <Link href="/superadmin/certificates" className="text-sm text-blue-600 hover:underline">
          ← Back to certificates
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/superadmin/certificates" className="text-sm text-blue-600 hover:underline">
          ← Back to certificates
        </Link>
        <button
          onClick={toggleStatus}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50 ${
            cert.status === 'active'
              ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
              : 'border-green-300 text-green-700 hover:bg-green-50'
          }`}
        >
          {cert.status === 'active' ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
          {cert.status === 'active' ? 'Revoke' : 'Reinstate'}
        </button>
      </div>

      {cert.status === 'revoked' && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          This certificate is <strong>revoked</strong>. The public verification page shows it as invalid.
        </div>
      )}

      <CertificatePreviewPanel cert={cert} verifyUrl={verifyUrl} />
    </div>
  );
}
