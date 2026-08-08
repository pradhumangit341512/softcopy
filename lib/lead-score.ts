/**
 * Lead scoring (Gap 3, Phase A — rule-based).
 *
 * Turns the signals we already capture on a Client into a 0–100 score and a
 * Hot / Warm / Cold band, plus a short list of human-readable reasons. Pure and
 * deterministic so it is trivial to test and safe to run on both server (write
 * paths + migration) and client (display).
 *
 * The score is recomputed on every meaningful write (create, update,
 * follow-up), so engagement/recency stay reasonably fresh without a cron. A
 * nightly recompute can be layered on later to age idle leads down.
 */

export const LEAD_BANDS = ['Hot', 'Warm', 'Cold'] as const;
export type LeadBand = (typeof LEAD_BANDS)[number];

export interface ScorableLead {
  status?: string | null;             // New | Interested | DealDone | Rejected
  inquiryType?: string | null;        // Buy | Sell | Rent
  requirementType?: string | null;    // 3BHK | Villa | Property (generic) | …
  budget?: number | null;
  preferredLocation?: string | null;
  email?: string | null;
  propertyVisited?: boolean | null;
  followUps?: { outcome?: string }[] | null;
  lastContactDate?: Date | string | null;
  followUpDate?: Date | string | null;
}

export interface LeadScore {
  score: number;        // 0–100
  band: LeadBand;
  reasons: string[];
}

const GENERIC_REQUIREMENTS = new Set(['Property', 'Rental']);

function daysSince(date?: Date | string | null): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

/** Score a lead from the signals we already store. Higher = more likely to close. */
export function scoreLead(lead: ScorableLead): LeadScore {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => { score += points; reasons.push(reason); };

  // Terminal statuses short-circuit — no point ranking a closed lead.
  if (lead.status === 'DealDone') return { score: 100, band: 'Hot', reasons: ['Deal done'] };
  if (lead.status === 'Rejected') return { score: 0, band: 'Cold', reasons: ['Rejected'] };

  // Intent / stage
  if (lead.status === 'Interested') add(25, 'Marked interested');
  else add(8, 'New lead');

  // A named budget is the strongest "serious buyer" signal we have.
  if (lead.budget != null && lead.budget > 0) add(15, 'Budget provided');

  // Specific requirement (3BHK/Villa/…) beats a vague "Property".
  if (lead.requirementType && !GENERIC_REQUIREMENTS.has(lead.requirementType)) {
    add(10, `Specific requirement (${lead.requirementType})`);
  }

  // Buy/Rent intent converts sooner than a seller enquiry.
  if (lead.inquiryType === 'Buy') add(10, 'Buyer');
  else if (lead.inquiryType === 'Rent') add(8, 'Renter');
  else if (lead.inquiryType === 'Sell') add(5, 'Seller');

  // A completed site visit is a very strong close signal.
  if (lead.propertyVisited) add(20, 'Site visited');

  // Engagement — capped so a chatty-but-cold lead can't top the list.
  const fuCount = lead.followUps?.length ?? 0;
  if (fuCount > 0) add(Math.min(fuCount * 5, 15), `${fuCount} follow-up${fuCount === 1 ? '' : 's'}`);

  // Recency of last contact.
  const dsc = daysSince(lead.lastContactDate);
  if (dsc != null) {
    if (dsc <= 7) add(10, 'Contacted this week');
    else if (dsc <= 30) add(5, 'Contacted this month');
    else reasons.push('Not contacted in 30+ days');
  }

  // A future scheduled follow-up shows the deal is live.
  const dueIn = daysSince(lead.followUpDate);
  if (dueIn != null && dueIn <= 0) add(5, 'Follow-up scheduled');

  // Profile completeness (light touch).
  if (lead.email) add(2, 'Has email');
  if (lead.preferredLocation) add(3, 'Location known');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: LeadBand = score >= 60 ? 'Hot' : score >= 30 ? 'Warm' : 'Cold';
  return { score, band, reasons };
}
