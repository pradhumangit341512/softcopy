/**
 * Lead ↔ inventory matching (Phase 3, item 3.4).
 *
 * Given an active buyer/renter lead (Client) and a unit, decide whether the
 * lead is a plausible match. Deliberately fuzzy but explainable — used to show
 * "N matching leads" per unit. Pure functions so they are easy to test.
 *
 * Match = purpose aligns AND requirement type is compatible AND (for sales) the
 * budget covers the price AND the location is loosely compatible.
 */

export interface MatchClient {
  inquiryType: string;         // Buy | Sell | Rent
  requirementType: string;     // 1BHK | Villa | Land | Commercial | Property | …
  budget?: number | null;
  preferredLocation?: string | null;
}

export interface MatchUnit {
  assetType?: string | null;   // Flat | Villa | Plot | Commercial | …
  listingType?: string | null; // Sale | Resale | Rent | Lease
  price?: number | null;
}

/** Sale/Resale units want buyers; Rent/Lease units want renters. */
function purposeMatches(inquiryType: string, listingType?: string | null): boolean {
  if (!listingType) return true;
  if (listingType === 'Rent' || listingType === 'Lease') return inquiryType === 'Rent';
  return inquiryType === 'Buy';
}

/** Whether a lead's requirement type is compatible with the unit's asset type. */
function requirementMatches(reqType: string, assetType?: string | null): boolean {
  if (!assetType) return true; // unit type unknown → don't exclude
  const a = assetType.toLowerCase();
  const anyOf = (...keys: string[]) => keys.some((k) => a.includes(k));
  switch (reqType) {
    case 'Villa': return anyOf('villa');
    case 'Land':
    case 'FarmHouse': return anyOf('plot', 'land', 'farmhouse');
    case 'Commercial': return anyOf('commercial', 'shop', 'office', 'showroom', 'warehouse', 'godown');
    case '1BHK':
    case '2BHK':
    case '3BHK':
    case '4BHK':
    case 'Studio': return anyOf('flat', 'builder', 'penthouse', 'kothi', 'house', 'apartment');
    case 'Property':
    case 'Rental':
    default: return true; // generic requirement → matches any asset
  }
}

/** Loose location match: shared token between the lead pref and project location. */
function locationMatches(pref: string | null | undefined, projectLoc: string): boolean {
  const p = (pref ?? '').trim().toLowerCase();
  const loc = projectLoc.trim().toLowerCase();
  if (!p || !loc) return true; // missing either side → don't exclude
  if (loc.includes(p) || p.includes(loc)) return true;
  return p.split(/[\s,]+/).some((tok) => tok.length > 2 && loc.includes(tok));
}

export function clientMatchesUnit(client: MatchClient, unit: MatchUnit, projectLoc: string): boolean {
  if (!purposeMatches(client.inquiryType, unit.listingType)) return false;
  if (!requirementMatches(client.requirementType, unit.assetType)) return false;
  // Budget only gates sales — rent budgets are monthly and comparing them to a
  // sale-style price would wrongly exclude renters.
  const isSale = !unit.listingType || unit.listingType === 'Sale' || unit.listingType === 'Resale';
  if (isSale && client.budget != null && unit.price != null && client.budget < unit.price) return false;
  return locationMatches(client.preferredLocation, projectLoc);
}
