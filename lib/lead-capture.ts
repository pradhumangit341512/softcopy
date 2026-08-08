/**
 * Inbound lead capture (Gap 1).
 *
 * Turns an arbitrary portal/Facebook/website payload into a Client, tolerating
 * the many field names portals use, deduping by phone within the company, and
 * scoring the new lead on the way in. Shared by the generic token endpoint and
 * the Facebook leadgen endpoint.
 */

import { db } from './db';
import { scoreLead } from './lead-score';

export const LEAD_CAPTURE_SOURCES = ['99acres', 'MagicBricks', 'Housing', 'Facebook', 'Website', 'Other'] as const;
export type LeadCaptureSource = (typeof LEAD_CAPTURE_SOURCES)[number];

/** First non-empty string/number value among the candidate keys. */
function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

/** Map a free-text requirement to our RequirementType enum (default 'Property'). */
function mapRequirement(v?: string): string {
  if (!v) return 'Property';
  const s = v.toLowerCase();
  if (s.includes('studio')) return 'Studio';
  const bhk = s.match(/([1-4])\s*bhk/);
  if (bhk) return `${bhk[1]}BHK`;
  if (s.includes('villa')) return 'Villa';
  if (s.includes('farm')) return 'FarmHouse';
  if (s.includes('plot') || s.includes('land')) return 'Land';
  if (s.includes('rent')) return 'Rental';
  if (s.includes('commerc') || s.includes('shop') || s.includes('office')) return 'Commercial';
  return 'Property';
}

/** Map a free-text purpose to our InquiryType enum (default 'Buy'). */
function mapInquiry(v?: string): string {
  if (!v) return 'Buy';
  const s = v.toLowerCase();
  if (s.includes('rent') || s.includes('lease')) return 'Rent';
  if (s.includes('sell') || s.includes('sale by owner')) return 'Sell';
  return 'Buy';
}

export interface NormalizedLead {
  clientName: string;
  phone: string;
  email: string | null;
  requirementType: string;
  inquiryType: string;
  budget: number | null;
  preferredLocation: string | null;
  notes: string | null;
}

/** Normalize an arbitrary inbound payload. Returns an error if there's no phone. */
export function normalizeInboundLead(
  payload: Record<string, unknown>,
): NormalizedLead | { error: string } {
  const phone = pick(payload, ['phone', 'mobile', 'contact', 'phone_number', 'mobile_number', 'contact_number']);
  if (!phone) return { error: 'A phone/mobile number is required' };

  const name = pick(payload, ['name', 'full_name', 'fullName', 'clientName', 'lead_name', 'customer_name']);
  const budgetRaw = pick(payload, ['budget', 'budget_max', 'max_budget', 'price']);
  const budget = budgetRaw ? Number(budgetRaw.replace(/[^\d.]/g, '')) || null : null;

  return {
    clientName: name || 'Portal Lead',
    phone,
    email: pick(payload, ['email', 'email_address']) ?? null,
    requirementType: mapRequirement(pick(payload, ['requirement', 'requirement_type', 'property_type', 'bhk', 'configuration'])),
    inquiryType: mapInquiry(pick(payload, ['purpose', 'inquiry_type', 'intent'])),
    budget,
    preferredLocation: pick(payload, ['location', 'preferred_location', 'city', 'locality', 'area']) ?? null,
    notes: pick(payload, ['message', 'notes', 'comments', 'query', 'requirement_details']) ?? null,
  };
}

export interface CaptureTarget {
  id: string;
  companyId: string;
  assignTo: string;
  source: string;
}

/** Create the lead (or dedup against an existing same-phone lead). Always bumps
 *  the webhook's capture counters. */
export async function captureLead(
  webhook: CaptureTarget,
  lead: NormalizedLead,
): Promise<{ deduped: boolean; clientId: string }> {
  const existing = await db.client.findFirst({
    where: { companyId: webhook.companyId, phone: lead.phone, deletedAt: null },
    select: { id: true },
  });

  await db.leadWebhook.update({
    where: { id: webhook.id },
    data: { capturedCount: { increment: 1 }, lastCapturedAt: new Date() },
  });

  if (existing) return { deduped: true, clientId: existing.id };

  const score = scoreLead({
    status: 'New',
    inquiryType: lead.inquiryType,
    requirementType: lead.requirementType,
    budget: lead.budget,
    preferredLocation: lead.preferredLocation,
    email: lead.email,
    propertyVisited: false,
    followUps: [],
    lastContactDate: null,
    followUpDate: null,
  });

  const client = await db.client.create({
    data: {
      clientName: lead.clientName,
      phone: lead.phone,
      email: lead.email,
      requirementType: lead.requirementType,
      inquiryType: lead.inquiryType,
      budget: lead.budget,
      preferredLocation: lead.preferredLocation,
      status: 'New',
      source: webhook.source,
      notes: lead.notes,
      leadScore: score.score,
      leadScoreBand: score.band,
      leadScoreReasons: score.reasons,
      companyId: webhook.companyId,
      createdBy: webhook.assignTo,
      ownedBy: webhook.assignTo,
      deletedAt: null,
    },
    select: { id: true },
  });

  return { deduped: false, clientId: client.id };
}
