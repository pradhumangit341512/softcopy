/**
 * Follow-up disposition config — the single source of truth for the outcome
 * list, how each outcome smart-links the lead's Status, and the default
 * cadence (days until the next suggested follow-up).
 *
 * Used by:
 *   - POST /api/clients/[id]/follow-up   (single complete)
 *   - POST /api/clients/bulk-follow-up   (bulk complete)
 *   - the Complete popup + Bulk modal in the leads UI
 *
 * Keep this list short and broker-friendly. To add/rename an outcome, edit
 * here only — every surface reads from this array.
 */

/** Lead status values the outcomes can smart-link to. */
export type LeadStatus = 'New' | 'Interested' | 'DealDone' | 'Rejected';

export interface Disposition {
  /** Stable machine value stored on the lead + in history. Never change once shipped. */
  value: string;
  /** Human label shown in dropdowns and the table. */
  label: string;
  /** If set, completing with this outcome also sets the lead's Status. */
  status?: LeadStatus;
  /** If true, also flips propertyVisited = true (e.g. "Site visit done"). */
  setsVisited?: boolean;
  /**
   * Default days from today to the next follow-up. Drives the smart-cadence
   * prefill. `null` = terminal outcome (no next follow-up by default).
   */
  cadenceDays: number | null;
}

export const DISPOSITIONS: readonly Disposition[] = [
  { value: 'no_answer',       label: 'No answer / Not reachable', cadenceDays: 1 },
  { value: 'call_back',       label: 'Call back later',           cadenceDays: 2 },
  { value: 'interested',      label: 'Interested',                status: 'Interested', cadenceDays: 3 },
  { value: 'visit_scheduled', label: 'Site visit scheduled',      status: 'Interested', cadenceDays: 2 },
  { value: 'visit_done',      label: 'Site visit done',           status: 'Interested', setsVisited: true, cadenceDays: 3 },
  { value: 'negotiating',     label: 'Negotiating',               status: 'Interested', cadenceDays: 2 },
  { value: 'deal_done',       label: 'Deal done',                 status: 'DealDone',   cadenceDays: null },
  { value: 'not_interested',  label: 'Not interested',            status: 'Rejected',   cadenceDays: null },
  { value: 'junk',            label: 'Wrong number / Junk',       status: 'Rejected',   cadenceDays: null },
] as const;

/** All valid disposition values — used for server-side validation. */
export const DISPOSITION_VALUES: readonly string[] = DISPOSITIONS.map((d) => d.value);

/** Look up a disposition by value (undefined if unknown). */
export function getDisposition(value: string): Disposition | undefined {
  return DISPOSITIONS.find((d) => d.value === value);
}

/** Human label for a stored outcome value, falling back to the raw value. */
export function outcomeLabel(value: string | null | undefined): string {
  if (!value) return '';
  return getDisposition(value)?.label ?? value;
}

/**
 * Suggested next follow-up date for an outcome, as a local YYYY-MM-DD string,
 * computed from `from` (defaults to today). Returns '' for terminal outcomes
 * so the UI leaves the date empty.
 */
export function suggestedNextDate(value: string, from: Date = new Date()): string {
  const d = getDisposition(value);
  if (!d || d.cadenceDays == null) return '';
  const next = new Date(from);
  next.setDate(next.getDate() + d.cadenceDays);
  const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}
