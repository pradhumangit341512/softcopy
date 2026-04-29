/**
 * Shared dropdown vocabularies. Kept as plain arrays so they're tree-shakeable
 * and trivially loaded by both server and client. Edit a list here and every
 * form / filter that imports it picks up the change on next render.
 *
 * Each list pairs a "preset" set with a free-text fallback in the UI — users
 * can always type a custom value because real-estate sources / statuses
 * vary by region and we don't want to wedge the form on a missing enum.
 */

/** Lead statuses — extended set per industry validation. Keep this in sync
 * with the `Client.status` field; new values won't break anything because
 * the column is a free-text String, but list filters will silently miss
 * statuses they don't know about. */
export const LEAD_STATUSES = [
  'New',
  'Hot',
  'NotConnected',
  'Serious',
  'Potential',
  'LongTerm',
  'DeadLead',
  'Completed',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Visual hint for status pills + filters. */
export const LEAD_STATUS_TONE: Record<LeadStatus, 'red' | 'amber' | 'blue' | 'emerald' | 'gray' | 'slate'> = {
  New: 'blue',
  Hot: 'red',
  NotConnected: 'gray',
  Serious: 'amber',
  Potential: 'amber',
  LongTerm: 'slate',
  DeadLead: 'gray',
  Completed: 'emerald',
};

/** Property statuses — split into occupancy + listing in a future phase.
 * Today this is the unified list shown on the Inventory tab strip. */
export const PROPERTY_STATUSES = [
  'Available',
  'Vacant',
  'SelfOccupied',
  'Rental',
  'ForSale',
  'Sold',
  'Rented',
] as const;

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

/** Lead sources — Indian real-estate channels users actually pay for, plus
 * organic/referral. Free-text fallback handles long-tail sources like
 * specific society notice boards. */
export const LEAD_SOURCES = [
  '99acres',
  'Magicbricks',
  'Housing.com',
  'Meta Ads',
  'WhatsApp',
  'Facebook',
  'Google',
  'Website',
  'Direct',
  'Referral',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

/** F11 — payment progress on the buyer side of a property deal. */
export const PAYMENT_STATUSES = ['Pending', 'Partial', 'Completed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** F11 — Indian real-estate deal mechanics.
 *  Registry  : fresh registration (full sub-registrar process)
 *  Transfer  : resale via society NOC, no fresh registry
 *  NewLaunch : under-construction direct from builder
 */
export const CASE_TYPES = ['Registry', 'Transfer', 'NewLaunch'] as const;
export type CaseType = (typeof CASE_TYPES)[number];

/** F11 — buyer's home-loan progress. Drives the funnel from lead → close. */
export const LOAN_STATUSES = ['NotApplied', 'Applied', 'Sanctioned', 'Disbursed'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

/** F18 — broker-side requirement triage status.
 *  Hot   : hot lead, follow up immediately
 *  Ok    : standard requirement, regular follow-up cycle
 *  Visit : already booked / about to visit a property
 */
export const BROKER_REQ_STATUSES = ['Hot', 'Ok', 'Visit'] as const;
export type BrokerReqStatus = (typeof BROKER_REQ_STATUSES)[number];

export const BROKER_REQ_STATUS_TONE: Record<BrokerReqStatus, 'red' | 'amber' | 'emerald'> = {
  Hot: 'red',
  Ok: 'amber',
  Visit: 'emerald',
};
