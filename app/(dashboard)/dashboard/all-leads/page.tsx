'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Download, Upload, Users, SlidersHorizontal, X, ArrowRightLeft, CalendarClock } from 'lucide-react';
import { BulkImportModal } from '@/components/clients/BulkImportModal';
import { TransferLeadModal } from '@/components/clients/TransferLeadModal';
import { BulkAssignModal } from '@/components/clients/BulkAssignModal';
import { BulkFollowUpModal } from '@/components/clients/BulkFollowUpModal';

import { Loader } from '@/components/common/Loader';
import { ClientTable } from '@/components/clients/ClientTable';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Alert } from '@/components/common/Alert';
import { Pagination } from '@/components/common/Pagination';

import type { Client } from '@/lib/types';
import { ClientFilters } from '@/components/clients/ClientFilters';
import { Button } from '@/components/common/Button';
import { TabStrip } from '@/components/common/TabStrip';
import { useConfirm } from '@/components/common/ConfirmDialog';

/**
 * Tab id → API filter params applied when that tab is active. Tabs are
 * coarse presets; the granular filter dropdowns suppress conflicting
 * fields while a tab is active. Each tab can pin any subset of fields —
 * F3 pins status, F4 pins inquiryType. Future tabs can pin multiple
 * fields by adding more entries to the inner record.
 */
const TAB_FILTERS: Record<string, Record<string, string>> = {
  dead:   { status: 'DeadLead' },
  buyers: { inquiryType: 'Buy' },
  rental: { inquiryType: 'Rent' },
};

export default function ClientsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [clients, setClients]         = useState<Client[]>([]);
  const [loading, setLoading]         = useState(true);
  const [exporting, setExporting]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);

  // ✅ Mobile: collapsible filter panel
  const [showFilters, setShowFilters] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Client | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkFollowUpOpen, setBulkFollowUpOpen] = useState(false);
  const canTransfer = useFeature('feature.lead_transfer');
  const canShowDeadTab = useFeature('feature.dead_leads_tab');
  const canShowTypeTabs = useFeature('feature.lead_type_tabs');
  const canExportLeads = useFeature('feature.export_leads');
  const confirm = useConfirm();

  // ── Read everything from URL (single source of truth) ──
  const searchFromUrl    = searchParams.get('search')    || '';
  const statusFromUrl    = searchParams.get('status')    || '';
  // F3 — `tab` is a coarse status preset that the tab strip writes. When a
  // tab is active it locks the API call to one status; the granular status
  // filter dropdown is hidden so the two can't conflict. `null` = "All Leads".
  const tabFromUrl       = searchParams.get('tab')       || '';
  const sourceFromUrl    = searchParams.get('source')    || '';
  const dateFromUrl      = searchParams.get('dateFrom')  || '';
  const dateToUrl        = searchParams.get('dateTo')    || '';
  const followUpFromUrl  = searchParams.get('followUp')  || '';
  const budgetMinFromUrl = searchParams.get('budgetMin') || '';
  const budgetMaxFromUrl = searchParams.get('budgetMax') || '';
  const bandFromUrl      = searchParams.get('band')      || '';
  const sortFromUrl      = searchParams.get('sort')      || '';
  const pageFromUrl      = parseInt(searchParams.get('page') || '1', 10);

  // Local state for filter UI — synced from URL
  const [filters, setFilters] = useState({
    status:    statusFromUrl,
    source:    sourceFromUrl,
    search:    searchFromUrl,
    dateFrom:  dateFromUrl,
    dateTo:    dateToUrl,
    followUp:  followUpFromUrl,
    budgetMin: budgetMinFromUrl,
    budgetMax: budgetMaxFromUrl,
  });

  useEffect(() => {
    setFilters({
      status:    statusFromUrl,
      source:    sourceFromUrl,
      search:    searchFromUrl,
      dateFrom:  dateFromUrl,
      dateTo:    dateToUrl,
      followUp:  followUpFromUrl,
      budgetMin: budgetMinFromUrl,
      budgetMax: budgetMaxFromUrl,
    });
  }, [searchFromUrl, statusFromUrl, sourceFromUrl, dateFromUrl, dateToUrl, followUpFromUrl, budgetMinFromUrl, budgetMaxFromUrl]);

  // Push filter changes to URL.
  //
  // Preserve the active `tab` param so applying a filter while on Buyers /
  // Rental / Dead Leads stays on that tab — only an explicit tab click
  // changes tabs. Every filter field that can be set via the panel is
  // rewritten from `newFilters`, so we only need to carry forward params
  // the panel doesn't own.
  const handleFilterChange = (newFilters: typeof filters) => {
    const params = new URLSearchParams();
    if (tabFromUrl)           params.set('tab',       tabFromUrl);
    if (newFilters.search)    params.set('search',    newFilters.search);
    if (newFilters.status)    params.set('status',    newFilters.status);
    if (newFilters.source)    params.set('source',    newFilters.source);
    if (newFilters.dateFrom)  params.set('dateFrom',  newFilters.dateFrom);
    if (newFilters.dateTo)    params.set('dateTo',    newFilters.dateTo);
    if (newFilters.followUp)  params.set('followUp',  newFilters.followUp);
    if (newFilters.budgetMin) params.set('budgetMin', newFilters.budgetMin);
    if (newFilters.budgetMax) params.set('budgetMax', newFilters.budgetMax);
    params.set('page', '1');
    router.push(`/dashboard/all-leads?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/dashboard/all-leads?${params.toString()}`);
  };

  // Count active filters for badge
  const activeFilterCount = [statusFromUrl, dateFromUrl, dateToUrl].filter(Boolean).length;

  // ── Fetch clients ──
  const fetchClients = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Tab takes precedence over the granular filters when the same field
      // is pinned by both — F3/F4 are mutually exclusive with their
      // matching dropdown filters so the API call must reflect that.
      const tabFilter = TAB_FILTERS[tabFromUrl] ?? {};
      const effectiveStatus = tabFilter.status || statusFromUrl;

      const params = new URLSearchParams({
        ...(searchFromUrl && { search: searchFromUrl }),
        ...(effectiveStatus && { status: effectiveStatus }),
        ...(tabFilter.inquiryType && { inquiryType: tabFilter.inquiryType }),
        ...(dateFromUrl && { dateFrom: dateFromUrl }),
        ...(dateToUrl && { dateTo: dateToUrl }),
        ...(bandFromUrl && { band: bandFromUrl }),
        ...(sortFromUrl && { sort: sortFromUrl }),
        page: String(pageFromUrl),
      });
      const response = await fetch(`/api/clients?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      setClients(data.clients || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalCount(data.pagination?.total || 0);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch clients';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id, searchFromUrl, statusFromUrl, tabFromUrl, dateFromUrl, dateToUrl, bandFromUrl, sortFromUrl, pageFromUrl]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, fetchClients]);

  // ── Export ──
  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        type: 'filtered',
        ...(statusFromUrl && { status:   statusFromUrl }),
        ...(searchFromUrl && { search:   searchFromUrl }),
        ...(dateFromUrl   && { dateFrom: dateFromUrl }),
        ...(dateToUrl     && { dateTo:   dateToUrl }),
      });
      const response = await fetch(`/api/clients/export?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'clients.xlsx';
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError('Failed to export clients');
    } finally {
      setExporting(false);
    }
  };

  // Complete the active follow-up with an outcome. The dedicated endpoint
  // records history, smart-links Status, and rolls the follow-up forward
  // (next date) or finishes it — all atomically.
  const handleCompleteFollowUp = async (
    clientId: string,
    payload: { outcome: string; note?: string; nextDate?: string },
  ) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/follow-up`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to complete follow-up');
      fetchClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete follow-up';
      setError(msg);
    }
  };

  // Inline single-field update for the list's Visit Date / Schedule-follow-up
  // quick edits — patches the lead directly so staff don't open the full form.
  const handleQuickUpdate = async (
    clientId: string,
    patch: { visitingDate?: string | null; followUpDate?: string | null },
  ) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      fetchClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update lead';
      setError(msg);
    }
  };

  const handleEdit   = (id: string) => router.push(`/dashboard/all-leads/${id}`);
  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this lead?',
      message: 'The lead will be soft-deleted and removed from your active list. Recoverable from the database; not from the app UI.',
      tone: 'danger',
      confirmText: 'Delete lead',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      fetchClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete client';
      setError(msg);
    }
  };

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">

      {/* ══ HEADER ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Leads
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Manage all your property leads
            {!loading && totalCount > 0 && (
              <span className="ml-1.5 text-gray-400">— {totalCount} total</span>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Mobile: filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className="sm:hidden relative flex items-center gap-1.5 px-3 py-2 text-sm
              font-medium text-gray-700 bg-white border border-gray-200 rounded-xl
              shadow-sm hover:bg-gray-50 transition-colors"
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white
                text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Bulk Import */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-medium text-gray-700 bg-white border border-gray-200
              rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Upload size={15} />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Export — gated by feature.export_leads */}
          {canExportLeads && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5
                text-sm font-medium text-gray-700 bg-white border border-gray-200
                rounded-xl shadow-sm hover:bg-gray-50 transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download size={15} className={exporting ? 'animate-bounce' : ''} />
              <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
            </button>
          )}

          {/* Add Leads */}
          <Link href="/dashboard/all-leads/add">
            <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
              rounded-xl shadow-sm transition-colors whitespace-nowrap">
              <Plus size={15} />
              <span className="hidden sm:inline">Add Leads</span>
              <span className="sm:hidden">Add</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ══ ERROR ══ */}
      {error && (
        <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
      )}

      {/* ══ FILTERS ══
          - Desktop: always visible
          - Mobile: collapsible via button above
      ══ */}
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm
        ${!showFilters ? 'hidden sm:block' : 'block'}`}>
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100
          flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-gray-400" />
            Filters
            {activeFilterCount > 0 && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                {activeFilterCount} active
              </span>
            )}
          </h3>
          {/* Mobile close */}
          <Button
            onClick={() => setShowFilters(false)}
            className="sm:hidden text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </Button>
        </div>
        <div className="p-4 sm:p-5">
          <ClientFilters
            filters={filters}
            onFilterChange={(f) => { handleFilterChange(f); setShowFilters(false); }}
          />
        </div>
      </div>

      {/* ══ TAB STRIP ══
          Coarse status presets. The active tab locks the API to one status
          and hides the granular status filter (so the two can't conflict).
          Tabs gated behind features hide entirely when the company doesn't
          have them — feature.dead_leads_tab today, F4/F5 will land here. */}
      <TabStrip
        ariaLabel="Leads view"
        activeTab={tabFromUrl}
        tabs={[
          { id: '',       label: 'All Leads' },
          { id: 'buyers', label: 'All Buyers',      visible: canShowTypeTabs },
          { id: 'rental', label: 'Rental Business', visible: canShowTypeTabs },
          { id: 'dead',   label: 'Dead Leads',      visible: canShowDeadTab },
        ]}
        onSelect={(nextTab) => {
          const params = new URLSearchParams(searchParams.toString());
          if (nextTab) params.set('tab', nextTab);
          else params.delete('tab');
          // Switching tabs always resets to page 1 — old page numbers
          // rarely make sense in the new filter scope.
          params.set('page', '1');
          // The granular status filter is mutually exclusive with tabs.
          // Clear it on tab change so refresh shows the tab's expected slice.
          params.delete('status');
          router.push(`/dashboard/all-leads?${params.toString()}`);
        }}
      />

      {/* ══ LEAD SCORE FILTER (Gap 3) ══ */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-400">Score:</span>
        {(['Hot', 'Warm', 'Cold'] as const).map((b) => {
          const active = bandFromUrl === b;
          return (
            <button
              key={b}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                if (active) params.delete('band'); else params.set('band', b);
                params.set('page', '1');
                router.push(`/dashboard/all-leads?${params.toString()}`);
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {b}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            if (sortFromUrl === 'score') params.delete('sort'); else params.set('sort', 'score');
            params.set('page', '1');
            router.push(`/dashboard/all-leads?${params.toString()}`);
          }}
          className={`ml-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
            sortFromUrl === 'score' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Sort by score
        </button>
      </div>

      {/* ══ BULK ACTION BAR ══ */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
            <input
              type="checkbox"
              checked
              readOnly
              className="w-4 h-4 rounded border-blue-300 text-blue-600"
            />
            {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkFollowUpOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white
                bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <CalendarClock size={14} />
              <span className="hidden sm:inline">Follow-up</span>
            </button>
            {canTransfer && (
              <button
                onClick={() => setBulkAssignOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white
                  bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <ArrowRightLeft size={14} />
                <span className="hidden sm:inline">Assign to teammate</span>
                <span className="sm:hidden">Assign</span>
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800
                hover:bg-blue-100 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ══ TABLE CARD ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Table header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100
          flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={14} className="text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">
              Leads
              {!loading && (
                <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100
                  px-2 py-0.5 rounded-full">
                  {clients.length}
                </span>
              )}
            </h3>
          </div>

          {/* Active search badge */}
          {searchFromUrl && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50
              border border-blue-100 px-2.5 py-1 rounded-full font-medium">
              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                "{searchFromUrl}"
              </span>
              <Button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('search');
                  router.push(`/dashboard/all-leads?${params.toString()}`);
                }}
                className="hover:text-blue-800 shrink-0"
              >
                <X size={12} />
              </Button>
            </div>
          )}
        </div>

        {/* Table body */}
        {loading ? (
          <div className="py-12 sm:py-16">
            <Loader message="Loading clients..." />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-3 px-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gray-50
              flex items-center justify-center">
              <Users size={22} className="text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-sm font-medium">
                {searchFromUrl
                  ? `No results for "${searchFromUrl}"`
                  : tabFromUrl === 'dead'
                  ? 'No dead leads'
                  : tabFromUrl === 'buyers'
                  ? 'No buyer leads'
                  : tabFromUrl === 'rental'
                  ? 'No rental leads'
                  : 'No leads yet'}
              </p>
              {(statusFromUrl || dateFromUrl || dateToUrl || tabFromUrl) && (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/all-leads')}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
            {!searchFromUrl && !statusFromUrl && (
              <Link href="/dashboard/all-leads/add">
                <button className="text-xs text-blue-600 hover:underline font-semibold">
                  + Add your first client
                </button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Horizontal scroll on small screens */}
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <ClientTable
                  clients={clients}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTransfer={canTransfer ? (c) => setTransferTarget(c) : undefined}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  onCompleteFollowUp={handleCompleteFollowUp}
                  onQuickUpdate={handleQuickUpdate}
                />
              </div>
            </div>

            {totalPages > 1 && (
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-100">
                <Pagination
                  currentPage={pageFromUrl}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  isLoading={loading}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => fetchClients()}
      />

      {/* Bulk Follow-up Modal — available to everyone (core follow-up flow) */}
      <BulkFollowUpModal
        isOpen={bulkFollowUpOpen}
        clientIds={Array.from(selectedIds)}
        onClose={() => setBulkFollowUpOpen(false)}
        onDone={() => {
          setSelectedIds(new Set());
          setBulkFollowUpOpen(false);
          fetchClients();
        }}
      />

      {/* Bulk Assign Modal */}
      {canTransfer && (
        <BulkAssignModal
          isOpen={bulkAssignOpen}
          clientIds={Array.from(selectedIds)}
          onClose={() => setBulkAssignOpen(false)}
          onTransferred={() => {
            setSelectedIds(new Set());
            setBulkAssignOpen(false);
            fetchClients();
          }}
        />
      )}

      {/* Transfer Lead Modal — only mounted when feature is enabled */}
      {canTransfer && (
        <TransferLeadModal
          isOpen={transferTarget !== null}
          clientId={transferTarget?.id ?? null}
          clientName={transferTarget?.clientName}
          currentOwnerId={transferTarget?.ownedBy ?? transferTarget?.creatorId ?? null}
          onClose={() => setTransferTarget(null)}
          onTransferred={() => {
            setTransferTarget(null);
            fetchClients();
          }}
        />
      )}
    </div>
  );
}

