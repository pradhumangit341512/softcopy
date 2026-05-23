'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Phone, FileText, X, ArrowRightLeft, AlertTriangle, Clock, CalendarCheck } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { formatCurrency, formatDate, getFollowUpStatus } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import { WhatsAppButton } from '@/components/common/WhatsAppButton';

import type { Client } from '@/lib/types';

interface ClientTableProps {
  clients: Client[];
  onEdit: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  /** When provided, a Transfer button appears next to Edit/Delete for each
   * row. Parent decides whether to show this based on feature gating. */
  onTransfer?: (client: Client) => void;
  /** When provided, checkboxes appear for bulk selection. */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}

const FOLLOW_UP_ICONS = {
  overdue: AlertTriangle,
  today: Clock,
  tomorrow: CalendarCheck,
  future: CalendarCheck,
} as const;

function FollowUpCell({ date }: { date: Date | string | undefined | null }) {
  const status = getFollowUpStatus(date);
  if (!date) return <td className="px-4 py-3 whitespace-nowrap"><span className="text-xs text-gray-400">—</span></td>;
  const Icon = status ? FOLLOW_UP_ICONS[status.key] : null;
  return (
    <td className="px-4 py-3 whitespace-nowrap">
      <div>
        <p className="text-xs text-gray-700">{formatDate(date)}</p>
        {status && Icon && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${status.style}`}>
            <Icon size={10} />
            {status.label}
          </span>
        )}
      </div>
    </td>
  );
}

/** Table component for displaying a list of clients with inline actions */
export function ClientTable({ clients, onEdit, onDelete, onTransfer, selectedIds, onSelectionChange }: ClientTableProps) {
  const selectable = !!selectedIds && !!onSelectionChange;
  const allSelected = selectable && clients.length > 0 && clients.every((c) => selectedIds.has(c.id));
  const someSelected = selectable && clients.some((c) => selectedIds.has(c.id)) && !allSelected;

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(clients.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close notes popup on click outside or Escape
  useEffect(() => {
    if (!openNoteId) return;

    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenNoteId(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenNoteId(null);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openNoteId]);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm min-w-[1050px]">

        {/* ── HEADER ── */}
        <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
          <tr>
            {selectable && (
              <th className="px-3 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !!someSelected; }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
            )}
            <th className="px-4 py-3 text-center w-20">Actions</th>
            <th className="px-4 py-3 text-left">Client</th>
            <th className="px-4 py-3 text-left">Contact</th>
            <th className="px-4 py-3 text-left">Requirement</th>
            <th className="px-4 py-3 text-left">Budget</th>
            <th className="px-4 py-3 text-left">Location</th>
            <th className="px-4 py-3 text-left">Visit Date</th>
            <th className="px-4 py-3 text-left">Follow Up</th>
            <th className="px-4 py-3 text-left">Next Follow Up</th>
            <th className="px-4 py-3 text-left">Notes</th>
            <th className="px-4 py-3 text-left">Visited</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>

        {/* ── BODY ── */}
        <tbody className="divide-y divide-gray-100 bg-white">
          {clients.length === 0 ? (
            <tr>
              <td colSpan={selectable ? 13 : 12} className="text-center py-12 text-gray-400 text-sm">
                No clients found
              </td>
            </tr>
          ) : (
            clients.map((client) => (
              <tr
                key={client.id}
                className={`hover:bg-gray-50 transition-colors duration-150 ${selectable && selectedIds?.has(client.id) ? 'bg-blue-50/50' : ''}`}
              >

                {/* CHECKBOX */}
                {selectable && (
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(client.id) ?? false}
                      onChange={() => toggleOne(client.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                )}

                {/* ACTIONS */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(client.id)}
                      title="Edit client"
                    >
                      <Edit2 size={14} />
                    </Button>

                    {onTransfer && (
                      <button
                        type="button"
                        onClick={() => onTransfer(client)}
                        title="Transfer to teammate"
                        className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50
                          flex items-center justify-center text-blue-500
                          hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      >
                        <ArrowRightLeft size={14} />
                      </button>
                    )}

                    {onDelete && (
                      <button
                        onClick={() => onDelete(client.id)}
                        title="Delete client"
                        className="w-7 h-7 rounded-lg border border-red-100 bg-red-50
                          flex items-center justify-center text-red-400
                          hover:bg-red-100 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>

                {/* CLIENT */}
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 leading-tight">
                    {client.clientName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {client.creator?.name ? `by ${client.creator.name}` : 'Unassigned'}
                  </p>
                </td>

                {/* CONTACT — click-to-call + WhatsApp */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${cleanPhone(client.phone)}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium group"
                      title="Click to call"
                    >
                      <Phone size={12} className="text-blue-500 group-hover:text-blue-700" />
                      {client.phone}
                    </a>
                    <WhatsAppButton
                      phone={client.phone}
                      message={`Hi ${client.clientName.split(' ')[0]}, following up on your enquiry.`}
                      ariaLabel={`WhatsApp ${client.clientName}`}
                    />
                  </div>
                  {client.email && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">
                      {client.email}
                    </p>
                  )}
                  {/* Follow-up hint under contact */}
                  {client.followUpDate && client.notes && (
                    <p className="text-[10px] text-amber-600 mt-1 truncate max-w-[180px]">
                      Last: {client.notes.slice(0, 40)}{client.notes.length > 40 ? '...' : ''}
                    </p>
                  )}
                </td>

                {/* REQUIREMENT */}
                <td className="px-4 py-3">
                  <p className="text-gray-900">{client.requirementType}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{client.inquiryType}</p>
                </td>

                {/* BUDGET */}
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {client.budget ? formatCurrency(client.budget) : '—'}
                </td>

                {/* LOCATION */}
                <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate">
                  {client.preferredLocation || '—'}
                </td>

                {/* VISIT DATE */}
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {formatDate(client.visitingDate)}
                </td>

                {/* FOLLOW UP */}
                <FollowUpCell date={client.followUpDate} />

                {/* NEXT FOLLOW UP */}
                <FollowUpCell date={client.nextFollowUp} />

                {/* NOTES — click to expand popup */}
                <td className="px-4 py-3 relative">
                  {client.notes ? (
                    <div>
                      <button
                        onClick={() => setOpenNoteId(openNoteId === client.id ? null : client.id)}
                        className="flex items-start gap-1 text-left group cursor-pointer max-w-[180px]"
                      >
                        <FileText size={12} className="text-blue-400 mt-0.5 shrink-0 group-hover:text-blue-600" />
                        <span className="text-xs text-gray-700 line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {client.notes}
                        </span>
                      </button>

                      {/* Notes Popup */}
                      {openNoteId === client.id && (
                        <div
                          ref={popoverRef}
                          className="absolute z-50 top-0 left-0 mt-8 w-72 bg-white rounded-xl
                            border border-gray-200 shadow-xl p-4 animate-in fade-in slide-in-from-top-2"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                              <FileText size={14} className="text-blue-500" />
                              {client.clientName}
                            </h4>
                            <button
                              onClick={() => setOpenNoteId(null)}
                              className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center
                                justify-center text-gray-400 hover:text-gray-600"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {/* Status + follow-up context */}
                          <div className="flex items-center gap-2 mb-3 text-xs">
                            <Badge
                              label={client.status}
                              variant={client.status === 'DealDone' ? 'success' : client.status === 'Rejected' ? 'danger' : 'primary'}
                              size="sm"
                            />
                            {client.followUpDate && (
                              <span className="text-gray-500">
                                Follow-up: {formatDate(client.followUpDate)}
                              </span>
                            )}
                          </div>

                          {/* Full notes */}
                          <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {client.notes}
                            </p>
                          </div>

                          {/* Quick actions */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                            <a
                              href={`tel:${cleanPhone(client.phone)}`}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              <Phone size={11} /> Call
                            </a>
                            <WhatsAppButton
                              phone={client.phone}
                              variant="inline"
                              message={`Hi ${client.clientName.split(' ')[0]}, following up on your enquiry.`}
                              ariaLabel={`WhatsApp ${client.clientName}`}
                            />
                            <button
                              onClick={() => { setOpenNoteId(null); onEdit(client.id); }}
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 font-medium ml-auto"
                            >
                              <Edit2 size={11} /> Edit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* VISITED */}
                <td className="px-4 py-3">
                  <Badge
                    label={client.propertyVisited ? 'Visited' : 'Not Visited'}
                    variant={client.propertyVisited ? 'success' : 'warning'}
                  />
                </td>

                {/* STATUS */}
                <td className="px-4 py-3">
                  <Badge
                    label={client.status}
                    variant={
                      client.status === 'DealDone'
                        ? 'success'
                        : client.status === 'Rejected'
                        ? 'danger'
                        : 'primary'
                    }
                  />
                </td>

              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
