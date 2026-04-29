/**
 * Find Opportunity matcher — F19
 *
 * Rule-based pairing of buyer leads with available inventory. The output
 * is intentionally explainable: each match carries the reasons it scored,
 * so a salesperson reading the page knows why the system suggested
 * "this Sector 24 unit for that Anjali lead".
 *
 * Why rule-based first
 * ────────────────────
 * Real-estate matching benefits from interpretability — brokers will
 * dismiss anything that looks like a black box. We start with explicit
 * weighted rules; an ML score can layer on later as a tiebreaker without
 * breaking the contract returned to the page.
 *
 * Score components (max 100)
 * ──────────────────────────
 *   project / sector / location match          : 35
 *   bhk / typology compatibility               : 25
 *   budget vs sellingPrice fit (±10% tolerance): 25
 *   listing intent matches (buy ↔ sale, rent)  : 15
 */

import type { Client, Property } from './types';

export interface MatchReason {
  /** Short label shown next to the property card. */
  label: string;
  /** Points contributed to the match score. */
  weight: number;
}

export interface MatchResult {
  /** The buyer / lead being matched against. */
  client: Client;
  /** The property suggested. */
  property: Property;
  /** 0–100. Higher = better match. */
  score: number;
  reasons: MatchReason[];
}

const W_LOCATION = 35;
const W_BHK = 25;
const W_BUDGET = 25;
const W_INTENT = 15;

/** Normalise a string for loose comparison (lowercase, collapse whitespace). */
function norm(s: string | undefined | null): string {
  return (s ?? '').trim().toLowerCase();
}

/** Loose substring containment in either direction. */
function contains(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/** Map a Client.inquiryType ('Buy' / 'Sell' / 'Rent') to the property
 *  field we expect to be set on a matching listing. */
function intentTargetField(inquiryType: string): 'sellingPrice' | 'askingRent' | null {
  const v = norm(inquiryType);
  if (v === 'buy' || v === 'sell') return 'sellingPrice';
  if (v === 'rent') return 'askingRent';
  return null;
}

/** Score one (client, property) pair; returns 0 + empty reasons if no signal. */
export function scorePair(client: Client, property: Property): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let score = 0;

  // ── 1. Location match — project, sector, or preferredLocation overlap ──
  const clientLoc = norm(client.preferredLocation);
  const projectName = norm(property.projectName);
  const sectorNo = norm(property.sectorNo);
  const address = norm(property.address);
  if (clientLoc) {
    if (projectName && contains(clientLoc, projectName)) {
      score += W_LOCATION;
      reasons.push({ label: `Project: ${property.projectName}`, weight: W_LOCATION });
    } else if (sectorNo && contains(clientLoc, sectorNo)) {
      score += W_LOCATION;
      reasons.push({ label: `Sector match`, weight: W_LOCATION });
    } else if (address && contains(clientLoc, address.split(',')[0] ?? '')) {
      score += Math.round(W_LOCATION * 0.6);
      reasons.push({ label: 'Address match', weight: Math.round(W_LOCATION * 0.6) });
    }
  }

  // ── 2. BHK / typology compatibility ──
  const clientReq = norm(client.requirementType);
  const bhk = norm(property.bhkType);
  const typology = norm(property.typology);
  if (clientReq) {
    if (bhk && contains(clientReq, bhk)) {
      score += W_BHK;
      reasons.push({ label: `BHK: ${property.bhkType}`, weight: W_BHK });
    } else if (typology && contains(clientReq, typology)) {
      score += W_BHK;
      reasons.push({ label: `Typology: ${property.typology}`, weight: W_BHK });
    }
  }

  // ── 3. Budget vs price (±10% tolerance) ──
  const intentField = intentTargetField(client.inquiryType ?? '');
  const budget = client.budget ?? 0;
  if (intentField && budget > 0) {
    const price = Number(property[intentField] ?? 0);
    if (price > 0) {
      const lower = budget * 0.9;
      const upper = budget * 1.1;
      if (price >= lower && price <= upper) {
        score += W_BUDGET;
        reasons.push({ label: 'Within budget', weight: W_BUDGET });
      } else if (price < budget * 1.25) {
        // close-but-over — partial credit so we still surface it
        score += Math.round(W_BUDGET * 0.4);
        reasons.push({ label: 'Near budget (slightly over)', weight: Math.round(W_BUDGET * 0.4) });
      }
    }
  }

  // ── 4. Intent match — Buy lead → property has sellingPrice; Rent → askingRent ──
  if (intentField === 'sellingPrice' && Number(property.sellingPrice ?? 0) > 0) {
    score += W_INTENT;
    reasons.push({ label: 'For sale', weight: W_INTENT });
  } else if (intentField === 'askingRent' && Number(property.askingRent ?? 0) > 0) {
    score += W_INTENT;
    reasons.push({ label: 'For rent', weight: W_INTENT });
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Top-N matches across the (clients × properties) cartesian.
 *
 * We hard-cap N to keep payloads reasonable; the page can paginate by
 * client if needed. Caller is responsible for pre-filtering soft-deleted
 * rows before passing them in.
 */
export function findOpportunities(
  clients: Client[],
  properties: Property[],
  opts: { minScore?: number; perClient?: number; topN?: number } = {}
): MatchResult[] {
  const minScore = opts.minScore ?? 30;
  const perClient = opts.perClient ?? 5;
  const topN = opts.topN ?? 200;

  const results: MatchResult[] = [];
  for (const c of clients) {
    const scored: MatchResult[] = [];
    for (const p of properties) {
      const { score, reasons } = scorePair(c, p);
      if (score >= minScore) {
        scored.push({ client: c, property: p, score, reasons });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    results.push(...scored.slice(0, perClient));
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}
