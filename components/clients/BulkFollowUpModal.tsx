'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { DISPOSITIONS, suggestedNextDate } from '@/lib/follow-up';

type Action = 'set_date' | 'snooze' | 'complete';

interface Props {
  isOpen: boolean;
  clientIds: string[];
  onClose: () => void;
  onDone?: () => void;
}

/** Local YYYY-MM-DD for today. */
function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

/**
 * Bulk follow-up actions across the selected leads:
 *   - Set / reschedule date   - Snooze by N days   - Complete with an outcome
 * Mirrors the single-lead Complete flow; posts to /api/clients/bulk-follow-up.
 */
export function BulkFollowUpModal({ isOpen, clientIds, onClose, onDone }: Props) {
  const [action, setAction] = useState<Action>('set_date');
  const [date, setDate] = useState('');
  const [snoozeDays, setSnoozeDays] = useState(2);
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAction('set_date');
    setDate(''); setSnoozeDays(2); setOutcome(''); setNote(''); setNextDate('');
    setSubmitting(false); setError(null); setResult(null);
  }, [isOpen]);

  const count = clientIds.length;
  const canSubmit =
    action === 'set_date' ? !!date :
    action === 'snooze' ? snoozeDays > 0 :
    !!outcome;

  async function submit() {
    if (!canSubmit || count === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { clientIds, action };
      if (action === 'set_date') body.date = date;
      if (action === 'snooze') body.snoozeDays = snoozeDays;
      if (action === 'complete') {
        body.outcome = outcome;
        if (note.trim()) body.note = note.trim();
        if (nextDate) body.nextDate = nextDate;
      }
      const res = await fetch('/api/clients/bulk-follow-up', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Bulk follow-up failed');
      setResult({ updated: j.updated, skipped: j.skipped });
      onDone?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const submitText =
    submitting ? 'Applying...' :
    action === 'complete' ? `Complete ${count} lead${count !== 1 ? 's' : ''}` :
    action === 'snooze' ? `Snooze ${count} lead${count !== 1 ? 's' : ''}` :
    `Update ${count} lead${count !== 1 ? 's' : ''}`;

  const tab = (id: Action, label: string) => (
    <button
      type="button"
      onClick={() => setAction(id)}
      className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        action === id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      title="Bulk follow-up"
      onClose={onClose}
      onSubmit={result || submitting || !canSubmit ? undefined : submit}
      submitText={submitText}
      size="md"
    >
      <div className="space-y-4">
        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CalendarClock className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">
                  {result.updated} lead{result.updated !== 1 ? 's' : ''} updated
                </p>
                {result.skipped > 0 && (
                  <p className="text-xs text-green-800 mt-1">{result.skipped} skipped (not owned by you)</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Done</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Apply to <span className="font-medium text-gray-900">{count} lead{count !== 1 ? 's' : ''}</span>.
            </p>

            {error && <Alert type="error" message={error} />}

            <div className="flex items-center gap-2">
              {tab('set_date', 'Set date')}
              {tab('snooze', 'Snooze')}
              {tab('complete', 'Complete')}
            </div>

            {action === 'set_date' && (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Follow-up date <span className="text-red-500">*</span></span>
                <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-400 mt-1 block">Sets the same follow-up date on every selected lead.</span>
              </label>
            )}

            {action === 'snooze' && (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Push by (days) <span className="text-red-500">*</span></span>
                <input type="number" min={1} max={365} value={snoozeDays}
                  onChange={(e) => setSnoozeDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                  className="mt-1 block w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-400 mt-1 block">Each lead&apos;s follow-up moves forward by this many days (from today if it has none).</span>
              </label>
            )}

            {action === 'complete' && (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Outcome <span className="text-red-500">*</span></span>
                  <select value={outcome}
                    onChange={(e) => { const v = e.target.value; setOutcome(v); setNextDate(v ? suggestedNextDate(v) : ''); }}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select outcome…</option>
                    {DISPOSITIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Note (optional)</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
                    placeholder="Applied to all selected leads…"
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Next follow-up</span>
                  <input type="date" value={nextDate} min={today()} onChange={(e) => setNextDate(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="text-xs text-gray-400 mt-1 block">Auto-filled from the outcome — change it or clear to finish those leads.</span>
                </label>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
