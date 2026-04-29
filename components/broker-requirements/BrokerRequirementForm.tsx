'use client';

/**
 * BrokerRequirementForm — F18
 *
 * Modal-style add/edit form. POST when no `initial`, PUT when editing.
 * Required fields: brokerName, contact, requirement.
 * Status defaults to "Ok" for new; preserves existing on edit.
 */

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Alert } from '@/components/common/Alert';
import { BROKER_REQ_STATUSES, LEAD_SOURCES, type BrokerReqStatus } from '@/lib/constants';
import type { BrokerRequirement } from '@/lib/types';

interface Props {
  initial?: BrokerRequirement;
  onClose: () => void;
  onSaved: (saved: BrokerRequirement) => void;
}

export function BrokerRequirementForm({ initial, onClose, onSaved }: Props) {
  const [brokerName, setBrokerName] = useState(initial?.brokerName ?? '');
  const [brokerCompany, setBrokerCompany] = useState(initial?.brokerCompany ?? '');
  const [contact, setContact] = useState(initial?.contact ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [status, setStatus] = useState<BrokerReqStatus>(
    (initial?.status as BrokerReqStatus) ?? 'Ok'
  );
  const [requirement, setRequirement] = useState(initial?.requirement ?? '');
  const [source, setSource] = useState(initial?.source ?? '');
  const [followUpDate, setFollowUpDate] = useState(
    initial?.followUpDate
      ? new Date(initial.followUpDate as string).toISOString().slice(0, 10)
      : ''
  );
  const [remark, setRemark] = useState(initial?.remark ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = initial
        ? `/api/broker-requirements/${initial.id}`
        : '/api/broker-requirements';
      const method = initial ? 'PUT' : 'POST';

      const body = {
        brokerName: brokerName.trim(),
        brokerCompany: brokerCompany || null,
        contact: contact.trim(),
        email: email || '',
        status,
        requirement: requirement.trim(),
        source: source || null,
        followUpDate: followUpDate || null,
        remark: remark || null,
      };

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // Defensive parse — an HTML error page (e.g. dev-time crash) would
      // throw inside .json() and mask the real status code otherwise.
      const j = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      if (!res.ok) {
        const detail = (j as { detail?: string }).detail;
        throw new Error(
          [(j as { error?: string }).error, detail].filter(Boolean).join(' — ') ||
            `Save failed (HTTP ${res.status})`
        );
      }
      onSaved(j as BrokerRequirement);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {initial ? 'Edit Broker Requirement' : 'New Broker Requirement'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <Alert type="error" message={error} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Broker Name *"
              placeholder="Full name"
              value={brokerName}
              onChange={(e) => setBrokerName(e.target.value)}
              required
            />
            <Input
              label="Broker Company"
              placeholder="e.g. Urban Deals"
              value={brokerCompany ?? ''}
              onChange={(e) => setBrokerCompany(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact *"
              placeholder="+91 XXXXX XXXXX"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="broker@example.com"
              value={email ?? ''}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BrokerReqStatus)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BROKER_REQ_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Input
              label="Follow-up Date"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requirement <span className="text-red-500">*</span>
            </label>
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              required
              rows={3}
              placeholder="e.g. 3BHK in DLF Cyber Sector 24, budget ₹2.5Cr, registry case preferred."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <Input
              label="Source"
              list="broker-req-sources"
              placeholder="Pick a source or type a custom one"
              value={source ?? ''}
              onChange={(e) => setSource(e.target.value)}
            />
            <datalist id="broker-req-sources">
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
            <textarea
              value={remark ?? ''}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder="Internal notes about this broker / requirement…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add Requirement'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
