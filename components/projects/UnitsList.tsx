'use client';

/**
 * Responsive units display for a Block (F17b/F17c UI polish).
 *
 * Renders the SAME data two ways so it reads well at every width:
 *   • lg+ screens → a compact table.
 *   • below lg   → stacked cards (no horizontal scrolling).
 *
 * Edit / delete / WhatsApp / Email actions are shared between both layouts via
 * one <UnitActions>. Status is colour-coded so a Block's mix of vacant / rented
 * / sold stock is scannable at a glance.
 */

import { Pencil, Trash2 } from 'lucide-react';
import type { Unit } from '@/lib/types';
import { ShareListingButtons } from '@/components/projects/ShareListingButtons';
import { formatUnitArea, formatUnitPrice, formatUnitPriceShort, formatUnitListing, statusLabel } from '@/lib/unit-options';

const STATUS_BADGE: Record<string, string> = {
  Available: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70',
  Vacant: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70',
  ForSale: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70',
  ReadyToMove: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/70',
  UnderConstruction: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200/70',
  Rented: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70',
  SelfOccupied: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200/70',
  Sold: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  OutOfStock: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/70',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

interface ShareCtx {
  projectName: string;
  towerName: string;
  location: string;
}

function UnitActions({
  unit,
  shareCtx,
  onEdit,
  onDelete,
}: {
  unit: Unit;
  shareCtx: ShareCtx;
  onEdit: (u: Unit) => void;
  onDelete: (u: Unit) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onEdit(unit)}
        aria-label={`Edit unit ${unit.unitNo}`}
        title="Edit unit"
        className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(unit)}
        aria-label={`Delete unit ${unit.unitNo}`}
        title="Delete unit"
        className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
      >
        <Trash2 size={12} />
      </button>
      <ShareListingButtons
        text={formatUnitListing(shareCtx, unit)}
        subject={`Listing: ${shareCtx.projectName} — Unit ${unit.unitNo}`}
      />
    </div>
  );
}

/** Type · listing summary line, e.g. "Flat · For Rent". */
function typeLine(unit: Unit): string {
  return [unit.assetType, unit.listingType].filter(Boolean).join(' · ') || '—';
}

/** Compact "matching leads" indicator (3.4). */
function MatchBadge({ count }: { count?: number }) {
  if (count == null) return <span className="text-gray-300">—</span>;
  if (count === 0) return <span className="text-gray-400">No leads</span>;
  return <span className="text-emerald-600 font-semibold">{count} lead{count === 1 ? '' : 's'}</span>;
}

export function UnitsList({
  units,
  editingUnitId,
  shareCtx,
  matches,
  onEdit,
  onDelete,
}: {
  units: Unit[];
  editingUnitId: string | null;
  shareCtx: ShareCtx;
  matches?: Record<string, number>;
  onEdit: (u: Unit) => void;
  onDelete: (u: Unit) => void;
}) {
  if (units.length === 0) return null;

  return (
    <div className="mt-3">
      {/* Desktop / large screens — table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Floor</th>
              <th className="px-3 py-2 text-left font-semibold">Unit No</th>
              <th className="px-3 py-2 text-left font-semibold">Config</th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Area</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Owner</th>
              <th className="px-3 py-2 text-left font-semibold">Leads</th>
              <th className="px-3 py-2 text-center font-semibold w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {units.map((u) => (
              <tr key={u.id} className={editingUnitId === u.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                <td className="px-3 py-2 text-gray-700">{u.floor}</td>
                <td className="px-3 py-2 font-semibold text-gray-900">{u.unitNo}</td>
                <td className="px-3 py-2 text-gray-700">{u.typology ?? '—'}</td>
                <td className="px-3 py-2 text-gray-700">
                  {u.assetType ?? '—'}
                  {u.listingType && <span className="ml-1 text-[10px] text-gray-400">· {u.listingType}</span>}
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatUnitArea(u) ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap"
                  title={formatUnitPrice(u) ?? undefined}>
                  {formatUnitPriceShort(u) ?? '—'}
                </td>
                <td className="px-3 py-2"><StatusBadge status={u.status} /></td>
                <td className="px-3 py-2 text-gray-700">{u.ownerName ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap"><MatchBadge count={matches?.[u.id]} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center">
                    <UnitActions unit={u} shareCtx={shareCtx} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet — cards */}
      <ul className="lg:hidden space-y-2.5">
        {units.map((u) => (
          <li
            key={u.id}
            className={`rounded-xl border p-3 ${
              editingUnitId === u.id ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {u.imageUrls && u.imageUrls[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.imageUrls[0]} alt="" className="w-11 h-11 rounded-lg object-cover border border-gray-200 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {u.unitNo}
                    {u.floor ? <span className="ml-1.5 text-xs font-normal text-gray-400">Floor {u.floor}</span> : null}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{[u.typology, typeLine(u)].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              <StatusBadge status={u.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
              {formatUnitArea(u) && <span>{formatUnitArea(u)}</span>}
              {formatUnitPriceShort(u) && (
                <span className="font-semibold text-gray-900" title={formatUnitPrice(u) ?? undefined}>
                  {formatUnitPriceShort(u)}
                </span>
              )}
              {u.ownerName && <span className="text-gray-500">Owner: {u.ownerName}</span>}
            </div>

            {u.tags && u.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {u.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">{t}</span>
                ))}
              </div>
            )}

            {matches?.[u.id] != null && (
              <p className="text-[11px] mt-2">
                {matches[u.id] > 0
                  ? <span className="text-emerald-600 font-semibold">{matches[u.id]} matching lead{matches[u.id] === 1 ? '' : 's'}</span>
                  : <span className="text-gray-400">No matching leads</span>}
              </p>
            )}

            <div className="flex items-center justify-end mt-2.5 pt-2.5 border-t border-gray-100">
              <UnitActions unit={u} shareCtx={shareCtx} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
