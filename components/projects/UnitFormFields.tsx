'use client';

/**
 * Shared unit form fields (F17b / F17c). Used by BOTH the add-unit and
 * edit-unit panels on the project detail page so the two forms can never drift.
 *
 * The form ADAPTS to what's being listed so one Block can hold mixed stock:
 *   • Flats / Villas / Commercial → BHK/config, bathrooms, parking, furnishing.
 *   • Plots → plot dimensions + corner-plot, no furnishing/interior/BHK.
 *   • Rentals (listingType = Rent) → deposit, maintenance, availability,
 *     preferred tenant, lock-in.
 *
 * Binds to a single all-string UnitDraft; the page converts it to/from the API
 * body via unitToDraft / unitDraftToBody in lib/unit-options.
 */

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/common/Input';
import {
  type UnitDraft,
  ASSET_TYPES,
  LISTING_TYPES,
  FURNISHINGS,
  INTERIOR_STATUSES,
  BHK_OPTIONS,
  FACINGS,
  PREFERRED_TENANTS,
  AREA_UNIT_VALUES,
  UNIT_STATUSES,
  DEAL_TYPES,
  SUGGESTED_TAGS,
  statusLabel,
  areaUnitSqft,
  areaUnitShort,
  isPlotAsset,
} from '@/lib/unit-options';

const SELECT_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-800 mb-2">{label}</label>
      {children}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Divider with a small caption, e.g. "Rental terms". */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 pt-1">{children}</p>
  );
}

/** Status dropdown with friendly labels (Self-occupied, Ready to move, …). */
function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Status">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        {UNIT_STATUSES.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </select>
    </Field>
  );
}

/** Location/feature tag chips: suggested toggles + free-text add, removable. */
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = (t: string) => {
    const v = t.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  const remove = (t: string) => onChange(tags.filter((x) => x !== t));
  const suggestions = SUGGESTED_TAGS.filter((s) => !tags.includes(s));

  return (
    <Field label="Tags">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
            {t}
            <button type="button" onClick={() => remove(t)} aria-label={`Remove ${t}`} className="text-blue-400 hover:text-blue-700">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
          placeholder="Add tag…"
          className="flex-1 min-w-[100px] px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => add(s)}
              className="px-2 py-0.5 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs hover:border-blue-300 hover:text-blue-600">
              + {s}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

/** Property image uploader — pushes each picked file to Vercel Blob and keeps
 *  the returned public URLs. Thumbnails are removable. */
function ImageUploader({ urls, onChange }: { urls: string[]; onChange: (u: string[]) => void }) {
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErr(null);
    const picked = Array.from(files);
    setUploading((n) => n + picked.length);
    const uploaded: string[] = [];
    for (const f of picked) {
      try {
        const fd = new FormData();
        fd.append('image', f);
        const res = await fetch('/api/uploads/unit-image', { method: 'POST', credentials: 'include', body: fd });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Upload failed');
        uploaded.push(j.imageUrl);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (uploaded.length) onChange([...urls, ...uploaded]);
  };

  return (
    <Field label="Property images">
      <div className="flex flex-wrap gap-2">
        {urls.map((u) => (
          <div key={u} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="Property" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange(urls.filter((x) => x !== u))} aria-label="Remove image"
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X size={11} />
            </button>
          </div>
        ))}
        <label className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-500 cursor-pointer text-xs font-medium">
          {uploading > 0 ? '…' : '+ Add'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </label>
      </div>
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
    </Field>
  );
}

export function UnitFormFields({
  value,
  onChange,
}: {
  value: UnitDraft;
  onChange: (v: UnitDraft) => void;
}) {
  const set = (patch: Partial<UnitDraft>) => onChange({ ...value, ...patch });

  const isPlot = isPlotAsset(value.assetType);
  const isBuilt = value.assetType !== '' && !isPlot; // Flat/Villa/Commercial/Shop/Office/Penthouse
  const isRent = value.listingType === 'Rent';
  const priceLabel = isRent ? 'Rent / month (₹)' : 'Total price (₹)';

  /** Switching asset type clears the fields that no longer apply, so a Plot
   *  never keeps a flat's bathrooms and a flat never keeps plot dimensions. */
  const changeAssetType = (next: string) => {
    const nextIsPlot = isPlotAsset(next);
    const nextIsBuilt = next !== '' && !nextIsPlot;
    const patch: Partial<UnitDraft> = { assetType: next };
    // Drop built-only fields unless the new type is built stock…
    if (!nextIsBuilt) {
      Object.assign(patch, { typology: '', bathrooms: '', parking: '', furnishing: '', interiorStatus: '' });
    }
    // …and drop plot-only fields unless the new type is a plot.
    if (!nextIsPlot) {
      Object.assign(patch, { plotDimensions: '', cornerPlot: '' });
    }
    set(patch);
  };

  /** Leaving "Rent" clears the rental-only terms so a Sale unit carries none. */
  const changeListingType = (next: string) => {
    const patch: Partial<UnitDraft> = { listingType: next };
    if (next !== 'Rent') {
      Object.assign(patch, {
        deposit: '', maintenanceMonthly: '', availableFrom: '', preferredTenant: '', lockInMonths: '',
      });
    }
    set(patch);
  };

  // 1.3 + 1.4 — area value/unit with exact conversion, and total auto-filled
  // from area × rate. Rate is per the chosen area unit.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const num = (s: string): number | null => {
    const x = Number(s);
    return s.trim() !== '' && Number.isFinite(x) ? x : null;
  };
  const autoTotal = (areaStr: string, rateStr: string): Partial<UnitDraft> => {
    const a = num(areaStr);
    const r = num(rateStr);
    return a != null && r != null ? { price: String(round2(a * r)) } : {};
  };
  const changeAreaValue = (v: string) => set({ areaValue: v, ...autoTotal(v, value.pricePerSqft) });
  const changeRate = (v: string) => set({ pricePerSqft: v, ...autoTotal(value.areaValue, v) });
  /** Switching unit converts both the size and the rate exactly, so the total holds. */
  const changeAreaUnit = (next: string) => {
    const oldF = areaUnitSqft(value.areaUnit);
    const newF = areaUnitSqft(next);
    const patch: Partial<UnitDraft> = { areaUnit: next };
    if (oldF !== newF) {
      const a = num(value.areaValue);
      if (a != null) patch.areaValue = String(round2((a * oldF) / newF));
      const r = num(value.pricePerSqft);
      if (r != null) patch.pricePerSqft = String(round2((r * newF) / oldF));
    }
    set(patch);
  };
  const rateLabel = `Price / ${areaUnitShort(value.areaUnit)} (₹)`;

  return (
    <div className="space-y-2">
      {/* Basics — always shown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Input label="Floor" type="number" placeholder="12"
          value={value.floor} onChange={(e) => set({ floor: e.target.value })} />
        <Input label="Unit No" required placeholder="B-1204"
          value={value.unitNo} onChange={(e) => set({ unitNo: e.target.value })} />
        <Select label="Asset type" value={value.assetType} placeholder="Select…"
          options={ASSET_TYPES} onChange={changeAssetType} />
        <Select label="Listing" value={value.listingType} placeholder="Select…"
          options={LISTING_TYPES} onChange={changeListingType} />
      </div>

      {/* Built stock (flats / villas / commercial): config, baths, parking, fit-out */}
      {isBuilt && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Configuration">
              <input
                list="unit-bhk-options"
                value={value.typology}
                onChange={(e) => set({ typology: e.target.value })}
                placeholder="3 BHK"
                className={SELECT_CLASS}
              />
              <datalist id="unit-bhk-options">
                {BHK_OPTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </Field>
            <Input label="Bathrooms" type="number" placeholder="2"
              value={value.bathrooms} onChange={(e) => set({ bathrooms: e.target.value })} />
            <Input label="Parking" placeholder="2 covered"
              value={value.parking} onChange={(e) => set({ parking: e.target.value })} />
            <Select label="Facing" value={value.facing} placeholder="Select…"
              options={FACINGS} onChange={(v) => set({ facing: v })} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Select label="Furnishing" value={value.furnishing} placeholder="Select…"
              options={FURNISHINGS} onChange={(v) => set({ furnishing: v })} />
            <Select label="Interior" value={value.interiorStatus} placeholder="Select…"
              options={INTERIOR_STATUSES} onChange={(v) => set({ interiorStatus: v })} />
            <StatusSelect value={value.status} onChange={(v) => set({ status: v })} />
          </div>
        </>
      )}

      {/* Plot stock: dimensions, corner, facing */}
      {isPlot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input label="Plot size (dimensions)" placeholder="30 x 40 ft"
            value={value.plotDimensions} onChange={(e) => set({ plotDimensions: e.target.value })} />
          <Select label="Facing" value={value.facing} placeholder="Select…"
            options={FACINGS} onChange={(v) => set({ facing: v })} />
          <Select label="Status" value={value.status}
            options={UNIT_STATUSES} onChange={(v) => set({ status: v })} />
          <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2.5">
            <input
              type="checkbox"
              checked={value.cornerPlot === 'yes'}
              onChange={(e) => set({ cornerPlot: e.target.checked ? 'yes' : '' })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            Corner plot
          </label>
        </div>
      )}

      {/* When no asset type is chosen yet, still let the user set a status. */}
      {!isBuilt && !isPlot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select label="Status" value={value.status}
            options={UNIT_STATUSES} onChange={(v) => set({ status: v })} />
        </div>
      )}

      {/* Pricing — always shown. Total auto-fills from area × rate (editable). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Input label="Area" type="number" placeholder="1850"
          value={value.areaValue} onChange={(e) => changeAreaValue(e.target.value)} />
        <Select label="Unit" value={value.areaUnit}
          options={AREA_UNIT_VALUES} onChange={changeAreaUnit} />
        <Input label={rateLabel} type="number" placeholder="9500"
          value={value.pricePerSqft} onChange={(e) => changeRate(e.target.value)} />
        <Input label={priceLabel} type="number" placeholder="Auto from rate"
          value={value.price} onChange={(e) => set({ price: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Input label="RERA ID" placeholder="PRM/KA/…"
          value={value.reraId} onChange={(e) => set({ reraId: e.target.value })} />
      </div>

      {/* Cheque / cash split — internal pricing breakdown, never shared. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2.5">
          <input
            type="checkbox"
            checked={value.splitPrice === 'yes'}
            onChange={(e) => set({ splitPrice: e.target.checked ? 'yes' : '' })}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          Split cheque / cash
        </label>
        {value.splitPrice === 'yes' && (
          <>
            <Input label="Cheque (₹)" type="number" placeholder="4000000"
              value={value.chequeAmount} onChange={(e) => set({ chequeAmount: e.target.value })} />
            <Input label="Cash (₹)" type="number" placeholder="1850000"
              value={value.cashAmount} onChange={(e) => set({ cashAmount: e.target.value })} />
          </>
        )}
      </div>

      {/* Location / feature tags — public, appear in the share message. */}
      <TagInput tags={value.tags} onChange={(t) => set({ tags: t })} />

      {/* Property images (Vercel Blob). */}
      <ImageUploader urls={value.imageUrls} onChange={(u) => set({ imageUrls: u })} />

      {/* Rental terms — only when listing for rent */}
      {isRent && (
        <>
          <SectionLabel>Rental terms</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Input label="Deposit (₹)" type="number" placeholder="200000"
              value={value.deposit} onChange={(e) => set({ deposit: e.target.value })} />
            <Input label="Maintenance / mo (₹)" type="number" placeholder="3500"
              value={value.maintenanceMonthly} onChange={(e) => set({ maintenanceMonthly: e.target.value })} />
            <Input label="Available from" type="date"
              value={value.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
            <Input label="Lock-in (months)" type="number" placeholder="11"
              value={value.lockInMonths} onChange={(e) => set({ lockInMonths: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select label="Preferred tenant" value={value.preferredTenant} placeholder="Any"
              options={PREFERRED_TENANTS} onChange={(v) => set({ preferredTenant: v })} />
          </div>
        </>
      )}

      {/* Owner + notes — always shown */}
      <SectionLabel>Owner &amp; notes</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input label="Owner" placeholder="Rajesh Kumar"
          value={value.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
        <Input label="Owner phone" placeholder="+91 …"
          value={value.ownerPhone} onChange={(e) => set({ ownerPhone: e.target.value })} />
        <Input label="Owner email" type="email" placeholder="owner@example.com"
          value={value.ownerEmail} onChange={(e) => set({ ownerEmail: e.target.value })} />
      </div>

      {/* Deal source — internal only, never included in the share message. */}
      <SectionLabel>Deal source · internal — never shared</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Select label="Deal type" value={value.dealType} placeholder="Select…"
          options={DEAL_TYPES} onChange={(v) => set({ dealType: v })} />
        {value.dealType === 'Via dealer' && (
          <>
            <Input label="Dealer / firm" placeholder="Titu Bathinda"
              value={value.dealerName} onChange={(e) => set({ dealerName: e.target.value })} />
            <Input label="Dealer phone" placeholder="+91 …"
              value={value.dealerPhone} onChange={(e) => set({ dealerPhone: e.target.value })} />
            <Input label="Their brokerage %" type="number" placeholder="50"
              value={value.brokerageSharePct} onChange={(e) => set({ brokerageSharePct: e.target.value })} />
          </>
        )}
      </div>

      <Input label="Remarks" placeholder="Corner unit, park facing, negotiable…"
        value={value.remarks} onChange={(e) => set({ remarks: e.target.value })} />
    </div>
  );
}
