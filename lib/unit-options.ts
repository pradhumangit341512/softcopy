/**
 * Shared vocabulary + helpers for projects & units (F17 inventory).
 *
 * One home for the option lists, the form-draft ⇄ API-body converters, and the
 * WhatsApp/Email share formatting so the unit form, the units table, the Zod
 * validation schema, and the share message can never drift apart.
 *
 * Phase-1 parity with nextheights: expanded property types, Re-sale purpose,
 * multi-unit area with exact conversion (Gaj/Marla/Kanal/Acre…), auto total
 * from rate, Lakh/Crore price shorthand, and richer project statuses.
 *
 * Pure TypeScript (no React) so it is safe to import from both server routes
 * (validation) and client components (form/table/share).
 */

import { formatCurrency, formatCompactINR } from './utils';
import type { Unit } from './types';

// 1.1 — full property-type list (existing 'Flat'/'Commercial' values kept for
// back-compat with already-saved units; new granular types appended).
export const ASSET_TYPES = [
  'Flat', 'Builder Floor', 'Kothi / House', 'Villa', 'Penthouse',
  'Plot', 'Land / Farmhouse',
  'Shop', 'Office', 'Showroom', 'Warehouse / Godown', 'Commercial', 'Other',
] as const;
// 1.2 — property purpose (adds Re-sale for second-hand stock).
export const LISTING_TYPES = ['Sale', 'Resale', 'Rent', 'Lease'] as const;
export const FURNISHINGS = ['Furnished', 'Semi-furnished', 'Unfurnished'] as const;
export const INTERIOR_STATUSES = ['Done', 'In progress', 'Not done'] as const;
export const BHK_OPTIONS = ['1 RK', 'Studio', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'] as const;
export const FACINGS = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'] as const;
export const PREFERRED_TENANTS = ['Family', 'Bachelors', 'Company', 'Any'] as const;

// 2.3 — unit status. Existing occupancy values kept for back-compat; sales-
// availability values (Available, ReadyToMove, UnderConstruction, OutOfStock)
// added to match the reference app. Pick whichever fits the deal.
export const UNIT_STATUSES = [
  'Available', 'Vacant', 'ForSale', 'Rented', 'SelfOccupied',
  'UnderConstruction', 'ReadyToMove', 'Sold', 'OutOfStock',
] as const;
const UNAVAILABLE_STATUSES = new Set(['Sold', 'Rented', 'SelfOccupied', 'OutOfStock']);
/** True when a unit still counts toward "available" stock (not sold/rented/etc). */
export function isAvailableStatus(status?: string | null): boolean {
  return !!status && !UNAVAILABLE_STATUSES.has(status);
}

// 2.1 — deal source (internal only, never shared with clients).
export const DEAL_TYPES = ['Direct', 'Via dealer'] as const;
// 2.2 — suggested location/feature tags (users can also add custom ones).
export const SUGGESTED_TAGS = ['Main road', 'Corner', 'Green belt', 'Park facing', 'Gated society'] as const;

// 1.3 — area units with exact sq-ft conversion factors (Punjab/Haryana Marla
// = 272.25 sq ft, Kanal = 20 Marla). `short` is the compact per-unit label.
export const AREA_UNITS = [
  { value: 'Sq. Feet', short: 'sq ft', sqft: 1 },
  { value: 'Sq. Yard (Gaj)', short: 'sq yd', sqft: 9 },
  { value: 'Sq. Meter', short: 'sq m', sqft: 10.7639 },
  { value: 'Marla', short: 'marla', sqft: 272.25 },
  { value: 'Kanal', short: 'kanal', sqft: 5445 },
  { value: 'Acre', short: 'acre', sqft: 43560 },
  { value: 'Hectare', short: 'hectare', sqft: 107639 },
] as const;
export const AREA_UNIT_VALUES = AREA_UNITS.map((u) => u.value);
export const DEFAULT_AREA_UNIT = 'Sq. Feet';

export function areaUnitSqft(unit?: string | null): number {
  return AREA_UNITS.find((u) => u.value === unit)?.sqft ?? 1;
}
export function areaUnitShort(unit?: string | null): string {
  return AREA_UNITS.find((u) => u.value === unit)?.short ?? 'sq ft';
}

// 1.6 — project construction statuses.
export const PROJECT_STATUS_VALUES = ['PreLaunch', 'UnderConstruction', 'PartiallyReady', 'ReadyToMove'] as const;
const PROJECT_STATUS_LABELS: Record<string, string> = {
  PreLaunch: 'Pre-launch',
  UnderConstruction: 'Under construction',
  PartiallyReady: 'Partially ready',
  ReadyToMove: 'Ready to move',
};
export function projectStatusLabel(v?: string | null): string {
  return (v && PROJECT_STATUS_LABELS[v]) || 'Under construction';
}

export type AssetType = (typeof ASSET_TYPES)[number];
export type ListingType = (typeof LISTING_TYPES)[number];

/** Land-type assets (plots / farmland): plot dimensions + facing, no BHK/furnishing. */
const LAND_ASSET_TYPES = ['Plot', 'Land / Farmhouse'];
export function isPlotAsset(assetType?: string | null): boolean {
  return assetType != null && LAND_ASSET_TYPES.includes(assetType);
}

/** Every unit-form field as a string — the shape both the add and edit forms bind to. */
export interface UnitDraft {
  floor: string;
  unitNo: string;
  typology: string;
  assetType: string;
  listingType: string;
  furnishing: string;
  interiorStatus: string;
  facing: string;
  bathrooms: string;
  parking: string;
  plotDimensions: string;
  cornerPlot: string; // 'yes' | ''
  areaValue: string;
  areaUnit: string;
  pricePerSqft: string; // price per chosen area unit
  price: string;
  deposit: string;
  maintenanceMonthly: string;
  availableFrom: string; // 'YYYY-MM-DD'
  preferredTenant: string;
  lockInMonths: string;
  reraId: string;
  tags: string[];
  dealType: string;
  dealerName: string;
  dealerPhone: string;
  brokerageSharePct: string;
  imageUrls: string[];
  splitPrice: string; // 'yes' | ''
  chequeAmount: string;
  cashAmount: string;
  status: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  remarks: string;
}

export const EMPTY_UNIT_DRAFT: UnitDraft = {
  floor: '', unitNo: '', typology: '', assetType: '', listingType: '', furnishing: '',
  interiorStatus: '', facing: '', bathrooms: '', parking: '', plotDimensions: '', cornerPlot: '',
  areaValue: '', areaUnit: DEFAULT_AREA_UNIT, pricePerSqft: '', price: '', deposit: '',
  maintenanceMonthly: '', availableFrom: '', preferredTenant: '', lockInMonths: '', reraId: '',
  tags: [], dealType: '', dealerName: '', dealerPhone: '', brokerageSharePct: '',
  imageUrls: [], splitPrice: '', chequeAmount: '', cashAmount: '',
  status: 'Vacant', ownerName: '', ownerEmail: '', ownerPhone: '', remarks: '',
};

const trimOrNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());
const numOrNull = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const intOrNull = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Load an existing unit into the string-based form draft. */
export function unitToDraft(u: Unit): UnitDraft {
  const numStr = (n: number | null | undefined) => (n != null ? String(n) : '');
  return {
    floor: numStr(u.floor),
    unitNo: u.unitNo ?? '',
    typology: u.typology ?? '',
    assetType: u.assetType ?? '',
    listingType: u.listingType ?? '',
    furnishing: u.furnishing ?? '',
    interiorStatus: u.interiorStatus ?? '',
    facing: u.facing ?? '',
    bathrooms: numStr(u.bathrooms),
    parking: u.parking ?? '',
    plotDimensions: u.plotDimensions ?? '',
    cornerPlot: u.cornerPlot ? 'yes' : '',
    // Prefer the entered value+unit; fall back to legacy sq-ft-only rows.
    areaValue: u.areaValue != null ? String(u.areaValue) : numStr(u.areaSqft),
    areaUnit: u.areaUnit ?? DEFAULT_AREA_UNIT,
    pricePerSqft: numStr(u.pricePerSqft),
    price: numStr(u.price),
    deposit: numStr(u.deposit),
    maintenanceMonthly: numStr(u.maintenanceMonthly),
    availableFrom: u.availableFrom ?? '',
    preferredTenant: u.preferredTenant ?? '',
    lockInMonths: numStr(u.lockInMonths),
    reraId: u.reraId ?? '',
    tags: u.tags ?? [],
    dealType: u.dealType ?? '',
    dealerName: u.dealerName ?? '',
    dealerPhone: u.dealerPhone ?? '',
    brokerageSharePct: numStr(u.brokerageSharePct),
    imageUrls: u.imageUrls ?? [],
    splitPrice: u.splitPrice ? 'yes' : '',
    chequeAmount: numStr(u.chequeAmount),
    cashAmount: numStr(u.cashAmount),
    status: u.status ?? 'Vacant',
    ownerName: u.ownerName ?? '',
    ownerEmail: u.ownerEmail ?? '',
    ownerPhone: u.ownerPhones?.[0] ?? '',
    remarks: u.remarks ?? '',
  };
}

/** Convert a form draft into the JSON body the units API expects. Empty strings
 *  become null (clears the field on update); the phone becomes a 1-element
 *  array. `areaSqft` is derived (value × unit factor) so sq-ft consumers and
 *  sorting keep working regardless of the entry unit. */
export function unitDraftToBody(d: UnitDraft): Record<string, unknown> {
  const areaValue = numOrNull(d.areaValue);
  const areaSqft = areaValue != null ? Math.round(areaValue * areaUnitSqft(d.areaUnit) * 100) / 100 : null;
  return {
    floor: parseInt(d.floor, 10) || 0,
    unitNo: d.unitNo.trim(),
    typology: trimOrNull(d.typology),
    assetType: trimOrNull(d.assetType),
    listingType: trimOrNull(d.listingType),
    furnishing: trimOrNull(d.furnishing),
    interiorStatus: trimOrNull(d.interiorStatus),
    facing: trimOrNull(d.facing),
    bathrooms: intOrNull(d.bathrooms),
    parking: trimOrNull(d.parking),
    plotDimensions: trimOrNull(d.plotDimensions),
    cornerPlot: d.cornerPlot === 'yes' ? true : null,
    areaValue,
    areaUnit: areaValue != null ? (trimOrNull(d.areaUnit) ?? DEFAULT_AREA_UNIT) : null,
    areaSqft,
    pricePerSqft: numOrNull(d.pricePerSqft),
    price: numOrNull(d.price),
    deposit: numOrNull(d.deposit),
    maintenanceMonthly: numOrNull(d.maintenanceMonthly),
    availableFrom: trimOrNull(d.availableFrom),
    preferredTenant: trimOrNull(d.preferredTenant),
    lockInMonths: intOrNull(d.lockInMonths),
    reraId: trimOrNull(d.reraId),
    tags: d.tags.map((t) => t.trim()).filter(Boolean),
    dealType: trimOrNull(d.dealType),
    dealerName: trimOrNull(d.dealerName),
    dealerPhone: trimOrNull(d.dealerPhone),
    brokerageSharePct: numOrNull(d.brokerageSharePct),
    imageUrls: d.imageUrls.filter(Boolean),
    splitPrice: d.splitPrice === 'yes' ? true : null,
    chequeAmount: numOrNull(d.chequeAmount),
    cashAmount: numOrNull(d.cashAmount),
    status: d.status,
    ownerName: trimOrNull(d.ownerName),
    ownerEmail: trimOrNull(d.ownerEmail),
    ownerPhones: d.ownerPhone.trim() ? [d.ownerPhone.trim()] : [],
    remarks: trimOrNull(d.remarks),
  };
}

/** Fields the share message / price label read from. */
export interface UnitListingFields {
  unitNo: string;
  floor?: number | null;
  typology?: string | null;
  assetType?: string | null;
  listingType?: string | null;
  furnishing?: string | null;
  interiorStatus?: string | null;
  facing?: string | null;
  bathrooms?: number | null;
  parking?: string | null;
  plotDimensions?: string | null;
  cornerPlot?: boolean | null;
  areaValue?: number | null;
  areaUnit?: string | null;
  areaSqft?: number | null;
  size?: string | null;
  pricePerSqft?: number | null;
  price?: number | null;
  deposit?: number | null;
  maintenanceMonthly?: number | null;
  availableFrom?: string | null;
  preferredTenant?: string | null;
  reraId?: string | null;
  tags?: string[] | null;
  remarks?: string | null;
  // NOTE: dealType/dealerName/dealerPhone/brokerageSharePct are intentionally
  // absent here — they are internal-only and must never reach the share text.
}

/** "For Rent" reads as a monthly price; everything else is a one-off total. */
export function unitPriceLabel(listingType?: string | null): string {
  return listingType === 'Rent' ? 'Rent' : 'Price';
}

/** Friendly label for a unit status enum (e.g. 'SelfOccupied' → 'Self-occupied'). */
export function statusLabel(status?: string | null): string {
  switch (status) {
    case 'SelfOccupied': return 'Self-occupied';
    case 'ForSale': return 'For sale';
    case 'UnderConstruction': return 'Under construction';
    case 'ReadyToMove': return 'Ready to move';
    case 'OutOfStock': return 'Out of stock';
    default: return status || '—';
  }
}

/** Full headline price with Lakh/Crore shorthand, e.g. "₹58,50,000 (₹58.5 L)". */
export function formatUnitPrice(unit: UnitListingFields): string | null {
  if (unit.price == null) return null;
  const full = formatCurrency(unit.price);
  if (unit.listingType === 'Rent') return `${full}/mo`;
  const compact = formatCompactINR(unit.price);
  return compact !== full ? `${full} (${compact})` : full;
}

/** Compact price for tight table/card cells, e.g. "₹58.5 L" or "₹45,000/mo". */
export function formatUnitPriceShort(unit: UnitListingFields): string | null {
  if (unit.price == null) return null;
  const compact = formatCompactINR(unit.price);
  return unit.listingType === 'Rent' ? `${compact}/mo` : compact;
}

/** Best available area string: entered value+unit first, else sq ft, else legacy text. */
export function formatUnitArea(unit: UnitListingFields): string | null {
  if (unit.areaValue != null && unit.areaUnit) return `${unit.areaValue.toLocaleString('en-IN')} ${unit.areaUnit}`;
  if (unit.areaSqft != null) return `${unit.areaSqft.toLocaleString('en-IN')} sq ft`;
  return unit.size?.trim() || null;
}

/**
 * Human-readable listing block used verbatim in WhatsApp and email shares.
 * Only lines with data are included, so a sparse unit still reads cleanly.
 */
export function formatUnitListing(
  ctx: { projectName: string; towerName?: string; location?: string | null },
  unit: UnitListingFields,
): string {
  const title = [ctx.projectName, ctx.towerName].filter(Boolean).join(' · ');

  const specs = [
    unit.typology,
    unit.assetType,
    formatUnitArea(unit),
    unit.bathrooms != null ? `${unit.bathrooms} bath` : null,
    unit.facing ? `${unit.facing} facing` : null,
    unit.furnishing,
    unit.parking ? `Parking: ${unit.parking}` : null,
    unit.interiorStatus ? `Interior ${unit.interiorStatus.toLowerCase()}` : null,
    unit.cornerPlot ? 'Corner plot' : null,
    unit.plotDimensions ? `Plot ${unit.plotDimensions}` : null,
    unit.tags?.length ? unit.tags.join(', ') : null,
  ].filter(Boolean);

  const rateUnit = areaUnitShort(unit.areaUnit);
  const price = [
    formatUnitPrice(unit) ? `${unitPriceLabel(unit.listingType)}: ${formatUnitPrice(unit)}` : null,
    unit.pricePerSqft != null ? `${formatCurrency(unit.pricePerSqft)}/${rateUnit}` : null,
  ].filter(Boolean);

  const rental = unit.listingType === 'Rent'
    ? [
        unit.deposit != null ? `Deposit ${formatCurrency(unit.deposit)}` : null,
        unit.maintenanceMonthly != null ? `Maintenance ${formatCurrency(unit.maintenanceMonthly)}/mo` : null,
        unit.availableFrom ? `Available from ${unit.availableFrom}` : null,
        unit.preferredTenant ? `Preferred: ${unit.preferredTenant}` : null,
      ].filter(Boolean)
    : [];

  return [
    `🏢 ${title} — Unit ${unit.unitNo}`,
    ctx.location ? `📍 ${ctx.location}` : null,
    specs.length ? specs.join(' · ') : null,
    price.length ? `💰 ${price.join(' · ')}` : null,
    rental.length ? `🔑 ${rental.join(' · ')}` : null,
    unit.listingType ? `For ${unit.listingType}` : null,
    unit.reraId ? `RERA: ${unit.reraId}` : null,
    unit.remarks ? `📝 ${unit.remarks}` : null,
  ].filter(Boolean).join('\n');
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildMailtoUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
