'use client';

/**
 * TransferLeadModal
 *
 * Hand a lead over to another teammate. Calls
 * POST /api/clients/[id]/transfer with { toUserId, reason? }.
 *
 * Caller is responsible for invoking onTransferred() to refresh the parent
 * list — the modal closes itself on success but doesn't know what to refetch.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, UserCog } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';

interface Teammate {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

interface Props {
  isOpen: boolean;
  /** id of the lead being transferred */
  clientId: string | null;
  /** display name shown in the confirmation copy */
  clientName?: string;
  /** id of the current owner so we can de-emphasize them in the picker */
  currentOwnerId?: string | null;
  onClose: () => void;
  onTransferred?: () => void;
}

export function TransferLeadModal({
  isOpen,
  clientId,
  clientName,
  currentOwnerId,
  onClose,
  onTransferred,
}: Props) {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toUserId, setToUserId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the modal is (re)opened so a stale selection from
  // a prior transfer doesn't leak across leads.
  useEffect(() => {
    if (!isOpen) return;
    setToUserId('');
    setReason('');
    setError(null);
    setLoading(true);

    let cancelled = false;
    fetch('/api/users/teammates', { credentials: 'include' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load teammates');
        return j as { teammates: Teammate[] };
      })
      .then((j) => {
        if (cancelled) return;
        setTeammates(j.teammates);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  async function submit() {
    if (!clientId || !toUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/transfer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Transfer failed');
      onTransferred?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Filter out the current owner from the dropdown — transferring to the
  // existing owner is a server-side rejection, but failing fast in the UI
  // is friendlier.
  const eligible = teammates.filter((t) => t.id !== currentOwnerId);

  return (
    <Modal
      isOpen={isOpen}
      title="Transfer lead"
      onClose={onClose}
      onSubmit={submitting || !toUserId ? undefined : submit}
      submitText={submitting ? 'Transferring…' : 'Transfer'}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {clientName ? (
            <>
              Hand <span className="font-medium text-gray-900">{clientName}</span>{' '}
              over to another teammate. The new owner will see this lead in
              their list immediately. The audit log will record the transfer.
            </>
          ) : (
            'Hand this lead over to another teammate.'
          )}
        </p>

        {error && <Alert type="error" message={error} />}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Transfer to <span className="text-red-500">*</span>
          </span>
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            disabled={loading || eligible.length === 0}
            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">
              {loading
                ? 'Loading teammates…'
                : eligible.length === 0
                ? 'No eligible teammates'
                : 'Select a teammate…'}
            </option>
            {eligible.map((t) => (
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
            rows={3}
            maxLength={500}
            placeholder="e.g. Out of office, regional handoff, customer request…"
            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <span className="text-xs text-gray-400 mt-1 block">
            {reason.length} / 500 — recorded in the audit log.
          </span>
        </label>

        {toUserId && currentOwnerId && (
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <UserCog className="w-3.5 h-3.5" aria-hidden />
            <span>Current owner</span>
            <ArrowRight className="w-3 h-3" aria-hidden />
            <span className="font-medium text-gray-700">
              {eligible.find((t) => t.id === toUserId)?.name}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
