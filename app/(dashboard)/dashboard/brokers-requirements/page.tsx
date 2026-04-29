'use client';

/**
 * Brokers Requirements — F18
 *
 * Tracks incoming asks from outside brokers / channel partners. Distinct
 * from Leads (a buyer/seller) and Team (internal users). Common pattern:
 * an outside broker calls saying "I have a 3BHK buyer in Sector 24" — we
 * record their need + status (Hot / Ok / Visit) and follow up.
 *
 * Server-side gate: feature.broker_reqs. Page also guards client-side
 * via useFeature() so an unauthorized user gets the standard upgrade
 * empty-state instead of a confusing 403.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Download, Upload, Pencil, Trash2, Search, X, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import {
  BROKER_REQ_STATUSES,
  BROKER_REQ_STATUS_TONE,
  type BrokerReqStatus,
} from '@/lib/constants';
import { BrokerRequirementForm } from '@/components/broker-requirements/BrokerRequirementForm';
import { BrokerReqBulkImportModal } from '@/components/broker-requirements/BrokerReqBulkImportModal';
import { useConfirm } from '@/components/common/ConfirmDialog';
import type { BrokerRequirement } from '@/lib/types';

const TONE_TO_BADGE: Record<string, string> = {
  red:     'bg-red-50 text-red-700 border-red-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface ListResponse {
  items: BrokerRequirement[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export default function BrokerRequirementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const enabled        = useFeature('feature.broker_reqs');
  const canExport      = useFeature('feature.export_broker_reqs');
  const canBulkImport  = useFeature('feature.bulk_broker_reqs');
  const confirm = useConfirm();

  const searchFromUrl = searchParams.get('search') || '';
  const statusFromUrl = searchParams.get('status') || '';
  const pageFromUrl   = parseInt(searchParams.get('page') || '1', 10);

  const [items, setItems] = useState<BrokerRequirement[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrokerRequirement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState(searchFromUrl);
  const [exporting, setExporting] = useState(false);

  const pushUrl = useCallback(
    (next: { search?: string; status?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.search !== undefined) {
        if (next.search) params.set('search', next.search);
        else params.delete('search');
      }
      if (next.status !== undefined) {
        if (next.status) params.set('status', next.status);
        else params.delete('status');
      }
      if (next.page !== undefined) params.set('page', String(next.page));
      router.push(`/dashboard/brokers-requirements?${params.toString()}`);
    },
    [router, searchParams]
  );

  const fetchItems = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(searchFromUrl && { search: searchFromUrl }),
        ...(statusFromUrl && { status: statusFromUrl }),
        page: String(pageFromUrl),
      });
      const res = await fetch(`/api/broker-requirements?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to fetch');
      }
      const j: ListResponse = await res.json();
      setItems(j.items);
      setTotalPages(j.pagination.pages);
      setTotalCount(j.pagination.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [user?.id, searchFromUrl, statusFromUrl, pageFromUrl]);

  useEffect(() => {
    if (authLoading || !enabled) return;
    fetchItems();
  }, [authLoading, enabled, fetchItems]);

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Delete this broker requirement?',
      message: 'The entry will be hidden from the list. Recoverable from the database, not from the UI.',
      tone: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    const res = await fetch(`/api/broker-requirements/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      fetchItems();
    } else {
      const j = await res.json();
      setError(j.error || 'Delete failed');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        ...(searchFromUrl && { search: searchFromUrl }),
        ...(statusFromUrl && { status: statusFromUrl }),
      });
      const res = await fetch(`/api/broker-requirements/export?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'broker-requirements.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch {
      setError('Failed to export');
    } finally {
      setExporting(false);
    }
  }

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.broker_reqs" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Brokers Requirements
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Incoming requirements from channel partners
            {!loading && totalCount > 0 && (
              <span className="ml-1.5 text-gray-400">— {totalCount} total</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canBulkImport && (
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
                text-sm font-semibold text-gray-700 bg-white border border-gray-200
                hover:bg-gray-50 rounded-xl shadow-sm transition-colors"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}
          {canExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
                text-sm font-semibold text-gray-700 bg-white border border-gray-200
                hover:bg-gray-50 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <Download size={15} />
              <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Requirement</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Filter row */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pushUrl({ search, page: 1 })}
            placeholder="Search broker name, company, contact, requirement…"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); pushUrl({ search: '', page: 1 }); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => pushUrl({ status: '', page: 1 })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
              !statusFromUrl
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            All
          </button>
          {BROKER_REQ_STATUSES.map((s) => {
            const active = statusFromUrl === s;
            const tone = BROKER_REQ_STATUS_TONE[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => pushUrl({ status: active ? '' : s, page: 1 })}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  active ? TONE_TO_BADGE[tone] : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 sm:py-16">
            <Loader message="Loading…" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 sm:py-16 text-center text-sm text-gray-400">
            {searchFromUrl || statusFromUrl
              ? 'No matching broker requirements.'
              : 'No broker requirements yet. Click “Add Requirement” to start.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Broker</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Requirement</th>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Follow Up</th>
                    <th className="px-4 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it) => {
                    const tone = BROKER_REQ_STATUS_TONE[(it.status as BrokerReqStatus) ?? 'Ok'] ?? 'amber';
                    return (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 leading-tight">{it.brokerName}</p>
                          {it.brokerCompany && (
                            <p className="text-xs text-gray-500 mt-0.5">{it.brokerCompany}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`tel:${it.contact.replace(/[\s\-()]/g, '')}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <Phone size={12} /> {it.contact}
                          </a>
                          {it.email && (
                            <p className="text-xs text-gray-500 truncate max-w-[180px]">{it.email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${TONE_TO_BADGE[tone]}`}>
                            {it.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[280px]">
                          <p className="line-clamp-2">{it.requirement}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{it.source ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {it.followUpDate ? new Date(it.followUpDate as string).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditing(it); setShowForm(true); }}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleDelete(it.id)}
                              title="Delete"
                              className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <Pagination
                  currentPage={pageFromUrl}
                  totalPages={totalPages}
                  onPageChange={(p) => pushUrl({ page: p })}
                  isLoading={loading}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit drawer */}
      {showForm && (
        <BrokerRequirementForm
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchItems(); }}
        />
      )}

      {/* Bulk import modal — only mounted when feature is on so exceljs
          isn't pulled into the bundle for plans without access. */}
      {canBulkImport && (
        <BrokerReqBulkImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onImported={() => fetchItems()}
        />
      )}
    </div>
  );
}
