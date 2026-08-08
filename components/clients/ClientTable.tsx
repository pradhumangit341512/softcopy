'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Phone, FileText, X, ArrowRightLeft, CheckCircle2, CalendarDays, Plus, Pencil, History } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { formatCurrency, formatDate, getFollowUpStatus, timeAgo } from '@/lib/utils';
import { DISPOSITIONS, suggestedNextDate, outcomeLabel } from '@/lib/follow-up';
import { Button } from '@/components/common/Button';
import { WhatsAppButton } from '@/components/common/WhatsAppButton';

import type { Client, FollowUpEntry } from '@/lib/types';

/** Payload the Complete popup sends up to the page → POST /follow-up. */
export interface CompleteFollowUpPayload {
  outcome: string;
  note?: string;
  nextDate?: string;
}

interface ClientTableProps {
  clients: Client[];
  onEdit: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  /** When provided, a Transfer button appears next to Edit/Delete for each row. */
  onTransfer?: (client: Client) => void;
  /** When provided, checkboxes appear for bulk selection. */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Complete the active follow-up with an outcome (records history + rolls forward). */
  onCompleteFollowUp?: (clientId: string, payload: CompleteFollowUpPayload) => Promise<void>;
  /**
   * Inline single-field update used by the Visit Date, reschedule, and
   * "Set follow-up" quick-edit popups. Patches the lead directly (PUT).
   */
  onQuickUpdate?: (
    clientId: string,
    patch: { visitingDate?: string | null; followUpDate?: string | null }
  ) => Promise<void>;
}

function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}

/** Text colour per follow-up urgency — plain coloured label, no chip/icon clutter. */
const FU_TEXT: Record<'overdue' | 'today' | 'tomorrow' | 'future', string> = {
  overdue: 'text-red-600',
  today: 'text-amber-700',
  tomorrow: 'text-blue-600',
  future: 'text-gray-500',
};

/** Local YYYY-MM-DD for a date input (avoids UTC off-by-one). */
function toDateInput(d?: Date | string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

/**
 * Self-contained date-picker popover. Closes on outside-click / Escape and
 * disables Save until a date is chosen. Reused by Visit Date, reschedule, and
 * Set-follow-up quick edits.
 */
function DateEditPopover({
  title, subtitle, initial, min, saving, confirmLabel = 'Save', onSave, onClose,
}: {
  title: string; subtitle?: string; initial?: string; min?: string;
  saving: boolean; confirmLabel?: string; onSave: (value: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [onClose]);
  return (
    <div ref={ref} className="absolute z-50 top-full left-0 mt-1 w-60 bg-white rounded-xl
      border border-gray-200 shadow-xl p-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <CalendarDays size={14} className="text-blue-500" />{title}
        </h4>
        <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-2 truncate">{subtitle}</p>}
      <input type="date" value={value} min={min} onChange={(e) => setValue(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => onSave(value)} disabled={saving || !value}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {saving ? 'Saving...' : confirmLabel}
        </button>
        <button onClick={onClose} className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
      </div>
    </div>
  );
}

/** Newest follow-up history entry (the array is append-ordered), if any. */
function lastFollowUpEntry(client: Client): FollowUpEntry | undefined {
  const list = client.followUps;
  return list && list.length > 0 ? list[list.length - 1] : undefined;
}

interface ResolvedFollowUp {
  label: string;                      // human label ('' if none)
  when: Date | string | undefined;    // timestamp of the last follow-up
  by: string | undefined;             // who logged it
  note: string | undefined;           // free-text note, if any
}

/**
 * Single source of truth for a client's most recent follow-up display fields.
 * Prefers the newest history entry (it carries who + the note), falling back to
 * the denormalized lastFollowUp* mirror. Raw outcome codes resolve to human
 * labels via outcomeLabel(). Both follow-up renderers use this so they can
 * never describe different records for the same client.
 */
function resolveLastFollowUp(client: Client): ResolvedFollowUp {
  const last = lastFollowUpEntry(client);
  return {
    label: last?.label || client.lastFollowUpLabel || outcomeLabel(last?.outcome ?? client.lastFollowUpOutcome),
    when: last?.date ?? client.lastFollowUpAt,
    by: last?.byName,
    note: last?.note ?? undefined,
  };
}

/**
 * Compact "what happened last time" line for the Follow Up column (shown while a
 * follow-up is still pending). Renders nothing if the client has never had a
 * follow-up logged.
 */
function LastFollowUpLine({ client }: { client: Client }) {
  const { label, when, by, note } = resolveLastFollowUp(client);
  if (!label && !when) return null;

  const rel = timeAgo(when);
  const exact = when ? formatDate(when) : undefined;
  return (
    <p className="text-[11px] text-gray-500 truncate max-w-[150px]" title={note || exact || undefined}>
      <span className="text-gray-400">Last:</span>{' '}
      <span className="font-medium text-gray-600">{label || 'Logged'}</span>
      {rel && <span className="text-gray-400"> · {rel}</span>}
      {by && <span className="text-gray-400"> · {by}</span>}
    </p>
  );
}

/**
 * Green "completed" badge shown when there is no pending follow-up but the
 * client has a logged history: outcome · relative time · who. Values are
 * computed once here rather than re-invoked inline.
 */
function CompletedFollowUpBadge({ client }: { client: Client }) {
  const { label, when, by } = resolveLastFollowUp(client);
  const rel = timeAgo(when);
  const exact = when ? formatDate(when) : undefined;
  const title = [by ? `by ${by}` : undefined, exact].filter(Boolean).join(' · ') || undefined;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700" title={title}>
      <CheckCircle2 size={12} /> {label || 'Follow-up complete'}
      {rel && <span className="font-normal text-gray-400"> · {rel}</span>}
      {by && <span className="font-normal text-gray-400"> · {by}</span>}
    </span>
  );
}

/** Read-only Next-Follow-Up cell — plain date + coloured urgency label. */
function NextFollowUpCell({ date }: { date: Date | string | undefined | null }) {
  const status = getFollowUpStatus(date);
  if (!date) return <td className="px-4 py-3 whitespace-nowrap"><span className="text-xs text-gray-400">—</span></td>;
  return (
    <td className="px-4 py-3 whitespace-nowrap">
      <p className="text-xs text-gray-700">{formatDate(date)}</p>
      {status && <span className={`text-[11px] font-semibold ${FU_TEXT[status.key]}`}>{status.label}</span>}
    </td>
  );
}

const LEAD_BAND_STYLE: Record<string, string> = {
  Hot: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/70',
  Warm: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70',
  Cold: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
};

/** Lead-score pill: band + numeric score, with the scoring reasons on hover. */
function LeadScoreBadge({ client }: { client: Client }) {
  if (client.leadScore == null || !client.leadScoreBand) {
    return <span className="text-xs text-gray-300">—</span>;
  }
  const cls = LEAD_BAND_STYLE[client.leadScoreBand] ?? 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
  return (
    <span
      title={client.leadScoreReasons?.join(' · ') || undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}
    >
      {client.leadScoreBand} · {client.leadScore}
    </span>
  );
}

export function ClientTable({ clients, onEdit, onDelete, onTransfer, selectedIds, onSelectionChange, onCompleteFollowUp, onQuickUpdate }: ClientTableProps) {
  const selectable = !!selectedIds && !!onSelectionChange;
  const allSelected = selectable && clients.length > 0 && clients.every((c) => selectedIds.has(c.id));
  const someSelected = selectable && clients.some((c) => selectedIds.has(c.id)) && !allSelected;

  function toggleAll() {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(clients.map((c) => c.id)));
  }
  function toggleOne(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }

  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  // Complete-follow-up popup state
  const [completePopupId, setCompletePopupId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Inline quick-edit popups (Visit Date / reschedule / set follow-up)
  const [visitPopupId, setVisitPopupId] = useState<string | null>(null);
  const [schedulePopupId, setSchedulePopupId] = useState<string | null>(null);
  const [reschedulePopupId, setReschedulePopupId] = useState<string | null>(null);
  const [quickSavingId, setQuickSavingId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const completePopoverRef = useRef<HTMLDivElement>(null);

  const todayStr = toDateInput(new Date());

  // Close notes popup on outside-click / Escape
  useEffect(() => {
    if (!openNoteId) return;
    function handleClick(e: MouseEvent) { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpenNoteId(null); }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpenNoteId(null); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [openNoteId]);

  // Close complete popup on outside-click / Escape
  useEffect(() => {
    if (!completePopupId) return;
    function handleClick(e: MouseEvent) { if (completePopoverRef.current && !completePopoverRef.current.contains(e.target as Node)) closeComplete(); }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') closeComplete(); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [completePopupId]);

  function openComplete(clientId: string) {
    setCompletePopupId(clientId);
    setOutcome(''); setNote(''); setNextDate('');
  }
  function closeComplete() {
    setCompletePopupId(null);
    setOutcome(''); setNote(''); setNextDate('');
  }

  async function handleComplete(clientId: string) {
    if (!onCompleteFollowUp || !outcome) return;
    setSubmitting(true);
    try {
      await onCompleteFollowUp(clientId, { outcome, note: note.trim() || undefined, nextDate: nextDate || undefined });
      closeComplete();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickSave(
    clientId: string,
    patch: { visitingDate?: string | null; followUpDate?: string | null },
    close: () => void,
  ) {
    if (!onQuickUpdate) return;
    setQuickSavingId(clientId);
    try { await onQuickUpdate(clientId, patch); close(); }
    finally { setQuickSavingId(null); }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm min-w-[1050px]">
        <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
          <tr>
            {selectable && (
              <th className="px-3 py-3 w-10 text-center">
                <input type="checkbox" checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !!someSelected; }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              </th>
            )}
            <th className="px-4 py-3 text-center w-20">Actions</th>
            <th className="px-4 py-3 text-left">Client</th>
            <th className="px-4 py-3 text-left">Contact</th>
            <th className="px-4 py-3 text-left">Requirement</th>
            <th className="px-4 py-3 text-left">Notes</th>
            <th className="px-4 py-3 text-left">Budget</th>
            <th className="px-4 py-3 text-left">Location</th>
            <th className="px-4 py-3 text-left">Visit Date</th>
            <th className="px-4 py-3 text-left">Follow Up</th>
            <th className="px-4 py-3 text-left">Next Follow Up</th>
            <th className="px-4 py-3 text-left">Visited</th>
            <th className="px-4 py-3 text-left">Score</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100 bg-white">
          {clients.length === 0 ? (
            <tr><td colSpan={selectable ? 13 : 12} className="text-center py-12 text-gray-400 text-sm">No clients found</td></tr>
          ) : (
            clients.map((client) => {
              const fuStatus = getFollowUpStatus(client.followUpDate);
              const history = client.followUps ?? [];
              return (
              <tr key={client.id}
                className={`hover:bg-gray-50 transition-colors duration-150 ${selectable && selectedIds?.has(client.id) ? 'bg-blue-50/50' : ''}`}>

                {selectable && (
                  <td className="px-3 py-3 text-center">
                    <input type="checkbox" checked={selectedIds?.has(client.id) ?? false}
                      onChange={() => toggleOne(client.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  </td>
                )}

                {/* ACTIONS */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => onEdit(client.id)} title="Edit client"><Edit2 size={14} /></Button>
                    {onTransfer && (
                      <button type="button" onClick={() => onTransfer(client)} title="Transfer to teammate"
                        className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 flex items-center justify-center text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors">
                        <ArrowRightLeft size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(client.id)} title="Delete client"
                        className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>

                {/* CLIENT */}
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 leading-tight">{client.clientName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{client.creator?.name ? `by ${client.creator.name}` : 'Unassigned'}</p>
                </td>

                {/* CONTACT */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <a href={`tel:${cleanPhone(client.phone)}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium group" title="Click to call">
                      <Phone size={12} className="text-blue-500 group-hover:text-blue-700" />{client.phone}
                    </a>
                    <WhatsAppButton phone={client.phone} message={`Hi ${client.clientName.split(' ')[0]}, following up on your enquiry.`} ariaLabel={`WhatsApp ${client.clientName}`} />
                  </div>
                  {client.email && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{client.email}</p>}
                </td>

                {/* REQUIREMENT */}
                <td className="px-4 py-3">
                  <p className="text-gray-900">{client.requirementType}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{client.inquiryType}</p>
                </td>

                {/* NOTES — click to expand popup (note + follow-up timeline) */}
                <td className="px-4 py-3 relative">
                  {(client.notes || history.length > 0) ? (
                    <div>
                      <button onClick={() => setOpenNoteId(openNoteId === client.id ? null : client.id)}
                        className="flex items-start gap-1 text-left group cursor-pointer max-w-[180px]">
                        <FileText size={12} className="text-blue-400 mt-0.5 shrink-0 group-hover:text-blue-600" />
                        <span className="text-xs text-gray-700 line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {client.notes || `${history.length} follow-up${history.length !== 1 ? 's' : ''} logged`}
                        </span>
                      </button>

                      {openNoteId === client.id && (
                        <div ref={popoverRef}
                          className="absolute z-50 top-0 left-0 mt-8 w-80 bg-white rounded-xl border border-gray-200 shadow-xl p-4 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><FileText size={14} className="text-blue-500" />{client.clientName}</h4>
                            <button onClick={() => setOpenNoteId(null)} className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </div>

                          <div className="flex items-center gap-2 mb-3 text-xs">
                            <Badge label={client.status} variant={client.status === 'DealDone' ? 'success' : client.status === 'Rejected' ? 'danger' : 'primary'} size="sm" />
                            {client.followUpDate && <span className="text-gray-500">Next: {formatDate(client.followUpDate)}</span>}
                          </div>

                          {client.notes && (
                            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto mb-3">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                            </div>
                          )}

                          {/* Follow-up timeline (newest first) */}
                          {history.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1.5"><History size={11} />Follow-up history</p>
                              <ul className="space-y-1.5 max-h-44 overflow-y-auto">
                                {[...history].reverse().map((h, i) => (
                                  <li key={i} className="text-xs border-l-2 border-blue-100 pl-2">
                                    <span className="font-medium text-gray-800">{h.label || h.outcome}</span>
                                    <span className="text-gray-400"> · {formatDate(h.date)}</span>
                                    {h.byName && <span className="text-gray-400"> · {h.byName}</span>}
                                    {h.note && <p className="text-gray-600 mt-0.5">{h.note}</p>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                            <a href={`tel:${cleanPhone(client.phone)}`} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"><Phone size={11} /> Call</a>
                            <WhatsAppButton phone={client.phone} variant="inline" message={`Hi ${client.clientName.split(' ')[0]}, following up on your enquiry.`} ariaLabel={`WhatsApp ${client.clientName}`} />
                            <button onClick={() => { setOpenNoteId(null); onEdit(client.id); }} className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 font-medium ml-auto"><Edit2 size={11} /> Edit</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>

                {/* BUDGET */}
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{client.budget ? formatCurrency(client.budget) : '—'}</td>

                {/* LOCATION */}
                <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate">{client.preferredLocation || '—'}</td>

                {/* VISIT DATE — inline quick edit */}
                <td className="px-4 py-3 whitespace-nowrap relative">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700">{formatDate(client.visitingDate)}</span>
                    {onQuickUpdate && (
                      <button onClick={() => setVisitPopupId(visitPopupId === client.id ? null : client.id)} title="Set visit date"
                        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                        <CalendarDays size={15} />
                      </button>
                    )}
                  </div>
                  {onQuickUpdate && visitPopupId === client.id && (
                    <DateEditPopover title="Set visit date" subtitle={client.clientName} initial={toDateInput(client.visitingDate)}
                      saving={quickSavingId === client.id} onClose={() => setVisitPopupId(null)}
                      onSave={(v) => handleQuickSave(client.id, { visitingDate: v || null }, () => setVisitPopupId(null))} />
                  )}
                </td>

                {/* FOLLOW UP — outcome-driven, button-led */}
                <td className="px-4 py-3 whitespace-nowrap relative align-top">
                  {client.followUpDate ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-gray-700">{formatDate(client.followUpDate)}</p>
                        {onQuickUpdate && (
                          <button onClick={() => setReschedulePopupId(client.id)} title="Reschedule (without completing)"
                            className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                      {fuStatus && <p className={`text-[11px] font-semibold ${FU_TEXT[fuStatus.key]}`}>{fuStatus.label}</p>}
                      <LastFollowUpLine client={client} />
                      {onCompleteFollowUp && (
                        <button onClick={() => openComplete(client.id)}
                          className="flex items-center justify-center gap-1 w-full px-2.5 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                          <CheckCircle2 size={13} /> Complete
                        </button>
                      )}
                    </div>
                  ) : (client.lastFollowUpAt || client.lastContactDate) ? (
                    <div className="space-y-1">
                      <CompletedFollowUpBadge client={client} />
                      {onQuickUpdate && (
                        <button onClick={() => setSchedulePopupId(client.id)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"><Plus size={12} /> Schedule next</button>
                      )}
                    </div>
                  ) : (
                    onQuickUpdate ? (
                      <button onClick={() => setSchedulePopupId(client.id)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"><Plus size={12} /> Set follow-up</button>
                    ) : <span className="text-xs text-gray-400">—</span>
                  )}

                  {/* Reschedule (change date, stays pending — no outcome logged) */}
                  {onQuickUpdate && reschedulePopupId === client.id && (
                    <DateEditPopover title="Reschedule follow-up" subtitle={client.clientName} initial={toDateInput(client.followUpDate)} min={todayStr}
                      saving={quickSavingId === client.id} confirmLabel="Reschedule" onClose={() => setReschedulePopupId(null)}
                      onSave={(v) => handleQuickSave(client.id, { followUpDate: v }, () => setReschedulePopupId(null))} />
                  )}

                  {/* Set / Schedule a follow-up where there is none */}
                  {onQuickUpdate && schedulePopupId === client.id && (
                    <DateEditPopover title="Schedule follow-up" subtitle={client.clientName} min={todayStr}
                      saving={quickSavingId === client.id} confirmLabel="Schedule" onClose={() => setSchedulePopupId(null)}
                      onSave={(v) => handleQuickSave(client.id, { followUpDate: v }, () => setSchedulePopupId(null))} />
                  )}

                  {/* Complete with outcome */}
                  {onCompleteFollowUp && completePopupId === client.id && (
                    <div ref={completePopoverRef}
                      className="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500" />Complete follow-up</h4>
                        <button onClick={closeComplete} className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{client.clientName} — {formatDate(client.followUpDate)}</p>

                      <label className="block text-xs font-medium text-gray-700 mb-1">What happened? <span className="text-red-500">*</span></label>
                      <select value={outcome}
                        onChange={(e) => { const v = e.target.value; setOutcome(v); setNextDate(v ? suggestedNextDate(v) : ''); }}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-3 bg-white">
                        <option value="">Select outcome…</option>
                        {DISPOSITIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>

                      <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What the client said…"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-3 resize-none" />

                      <label className="block text-xs font-medium text-gray-700 mb-1">Next follow-up</label>
                      <input type="date" value={nextDate} min={todayStr} onChange={(e) => setNextDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                      <p className="text-[11px] text-gray-400 mt-1">Auto-filled from the outcome — change it or clear to finish.</p>

                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={() => handleComplete(client.id)} disabled={submitting || !outcome}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                          <CheckCircle2 size={14} />{submitting ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={closeComplete} className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </td>

                {/* NEXT FOLLOW UP */}
                <NextFollowUpCell date={client.nextFollowUp} />

                {/* VISITED */}
                <td className="px-4 py-3">
                  <Badge label={client.propertyVisited ? 'Visited' : 'Not Visited'} variant={client.propertyVisited ? 'success' : 'warning'} />
                </td>

                {/* SCORE */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <LeadScoreBadge client={client} />
                </td>

                {/* STATUS */}
                <td className="px-4 py-3">
                  <Badge label={client.status}
                    variant={client.status === 'DealDone' ? 'success' : client.status === 'Rejected' ? 'danger' : 'primary'} />
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
