'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';

interface Teammate {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

interface Props {
  isOpen: boolean;
  clientIds: string[];
  onClose: () => void;
  onTransferred?: () => void;
}

export function BulkAssignModal({ isOpen, clientIds, onClose, onTransferred }: Props) {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ transferred: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setToUserId('');
    setReason('');
    setError(null);
    setResult(null);
    setLoading(true);

    let cancelled = false;
    fetch('/api/users/teammates', { credentials: 'include' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load teammates');
        return j as { teammates: Teammate[] };
      })
      .then((j) => {
        if (!cancelled) setTeammates(j.teammates);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  async function submit() {
    if (!toUserId || clientIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/clients/bulk-transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientIds,
          toUserId,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Bulk transfer failed');
      setResult({ transferred: j.transferred, skipped: j.skipped });
      onTransferred?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Bulk assign leads"
      onClose={onClose}
      onSubmit={result ? undefined : (submitting || !toUserId ? undefined : submit)}
      submitText={submitting ? 'Assigning...' : `Assign ${clientIds.length} lead${clientIds.length !== 1 ? 's' : ''}`}
      size="md"
    >
      <div className="space-y-4">
        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">
                  {result.transferred} lead{result.transferred !== 1 ? 's' : ''} assigned successfully
                </p>
                {result.skipped > 0 && (
                  <p className="text-xs text-green-800 mt-1">
                    {result.skipped} skipped (already owned or not authorized)
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600
                hover:bg-blue-700 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Assign <span className="font-medium text-gray-900">{clientIds.length} lead{clientIds.length !== 1 ? 's' : ''}</span> to a teammate.
            </p>

            {error && <Alert type="error" message={error} />}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Assign to <span className="text-red-500">*</span>
              </span>
              <select
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                disabled={loading || teammates.length === 0}
                className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">
                  {loading
                    ? 'Loading teammates...'
                    : teammates.length === 0
                    ? 'No teammates found'
                    : 'Select a teammate...'}
                </option>
                {teammates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.role})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Reason (optional)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. Regional handoff, workload balancing..."
                className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
