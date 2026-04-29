'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Building2, SlidersHorizontal, X, Download, Upload } from 'lucide-react';

import { Loader } from '@/components/common/Loader';
import { PropertyTable } from '@/components/properties/PropertyTable';
import { PropertyFilters, type PropertyFilterValues } from '@/components/properties/PropertyFilters';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Alert } from '@/components/common/Alert';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';
import { TabStrip } from '@/components/common/TabStrip';
import { PropertyBulkImportModal } from '@/components/properties/PropertyBulkImportModal';
import { useConfirm } from '@/components/common/ConfirmDialog';

import type { Property } from '@/lib/types';

/**
 * Tab id → API filter params applied when the tab is active. Mirrors the
 * leads-page TAB_FILTERS exactly so the UX feels uniform across the two
 * list pages. Tab takes precedence over the corresponding granular filter
 * (filter is silently ignored on a tab that pins the same field) so the
 * URL → results mapping is unambiguous.
 */
const TAB_FILTERS: Record<string, Record<string, string>> = {
  selling: { listingType: 'sale' },
  rental:  { listingType: 'rent' },
  dead:    { status: 'Sold' },
};

const EMPTY_FILTERS: PropertyFilterValues = {
  status: '',
  propertyType: '',
  bhkType: '',
  listingType: '',
  priceMin: '',
  priceMax: '',
  vacateFrom: '',
  vacateTo: '',
  createdBy: '',
  search: '',
};

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof PropertyFilterValues)[];

export default function PropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === 'user') {
      router.replace('/dashboard/my-work');
    }
  }, [authLoading, user, router]);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canShowInventoryTabs = useFeature('feature.inventory_tabs');
  const canBulkImportInventory = useFeature('feature.bulk_inventory');
  const confirm = useConfirm();
  const [showImportModal, setShowImportModal] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  // Read all filters from URL
  const filtersFromUrl: PropertyFilterValues = {
    status: searchParams.get('status') || '',
    propertyType: searchParams.get('propertyType') || '',
    bhkType: searchParams.get('bhkType') || '',
    listingType: searchParams.get('listingType') || '',
    priceMin: searchParams.get('priceMin') || '',
    priceMax: searchParams.get('priceMax') || '',
    vacateFrom: searchParams.get('vacateFrom') || '',
    vacateTo: searchParams.get('vacateTo') || '',
    createdBy: searchParams.get('createdBy') || '',
    search: searchParams.get('search') || '',
  };
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);
  // F5 — tab is a coarse preset that pins one or two fields. The granular
  // filter for the same field is silently ignored on the matching tab so
  // the two can't conflict. `''` means "All Inventory".
  const tabFromUrl = searchParams.get('tab') || '';

  const [filters, setFilters] = useState<PropertyFilterValues>(filtersFromUrl);

  useEffect(() => {
    setFilters(filtersFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Fetch team members for "Added By" filter (admin only)
  useEffect(() => {
    if (!isAdmin || !user?.companyId) return;
    fetch('/api/users?role=all&limit=100', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.users) {
          setTeamMembers(
            data.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))
          );
        }
      })
      .catch(() => {});
  }, [isAdmin, user?.companyId]);

  const handleFilterChange = (newFilters: PropertyFilterValues) => {
    // Preserve the active `tab` so applying a filter while on Selling /
    // Rental / Dead Inventory stays on that tab — only an explicit tab
    // click changes tabs. Same convention as the leads page.
    const params = new URLSearchParams();
    if (tabFromUrl) params.set('tab', tabFromUrl);
    for (const key of FILTER_KEYS) {
      if (newFilters[key]) params.set(key, newFilters[key]);
    }
    params.set('page', '1');
    router.push(`/dashboard/inventory?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/dashboard/inventory?${params.toString()}`);
  };

  const activeFilterCount = FILTER_KEYS.filter(
    (k) => k !== 'search' && filtersFromUrl[k]
  ).length;

  const fetchProperties = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Tab pins take precedence over the granular filter for the same
      // field so the UI and the data stay in sync. We rebuild the params
      // by starting from the user's filter choices and then overwriting
      // the tab-pinned fields.
      const tabFilter = TAB_FILTERS[tabFromUrl] ?? {};
      const params = new URLSearchParams();
      for (const key of FILTER_KEYS) {
        if (filtersFromUrl[key]) params.set(key, filtersFromUrl[key]);
      }
      for (const [k, v] of Object.entries(tabFilter)) {
        params.set(k, v);
      }
      params.set('page', String(pageFromUrl));

      const response = await fetch(`/api/properties?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch properties');
      const data = await response.json();
      setProperties(data.properties || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch properties';
      setError(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, searchParams.toString(), pageFromUrl]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchProperties();
  }, [authLoading, fetchProperties]);

  const handleEdit = (id: string) => router.push(`/dashboard/inventory/${id}`);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this inventory item?',
      message: 'This soft-deletes the listing — it will no longer appear in inventory or matches. Recoverable from the database, but not from the app UI.',
      tone: 'danger',
      confirmText: 'Delete inventory',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      fetchProperties();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete property';
      setError(msg);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      for (const key of FILTER_KEYS) {
        if (filtersFromUrl[key]) params.set(key, filtersFromUrl[key]);
      }

      const res = await fetch(`/api/properties/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'properties.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Inventory
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Manage all inventory listings with owner details
            {!loading && totalCount > 0 && (
              <span className="ml-1.5 text-gray-400">— {totalCount} total</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          {/* F13 — Bulk import button. Hidden when feature.bulk_inventory
              is off; the API also rejects so direct URL hits 403. */}
          {canBulkImportInventory && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
                text-sm font-semibold text-gray-700 bg-white border border-gray-200
                hover:bg-gray-50 rounded-xl shadow-sm transition-colors whitespace-nowrap"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-semibold text-gray-700 bg-white border border-gray-200
              hover:bg-gray-50 rounded-xl shadow-sm transition-colors whitespace-nowrap
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <Link href="/dashboard/inventory/add">
            <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
              rounded-xl shadow-sm transition-colors whitespace-nowrap">
              <Plus size={15} />
              <span className="hidden sm:inline">Add Inventory</span>
              <span className="sm:hidden">Add</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
      )}

      {/* FILTERS */}
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
          <Button
            onClick={() => setShowFilters(false)}
            className="sm:hidden text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </Button>
        </div>
        <div className="p-4 sm:p-5">
          <PropertyFilters
            filters={filters}
            onFilterChange={(f) => { handleFilterChange(f); setShowFilters(false); }}
            teamMembers={teamMembers}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* ══ TAB STRIP ══
          Coarse listing-type / lifecycle presets. Tabs pin one or two
          fields and the matching granular filter is silently ignored on
          that tab. Hidden when feature.inventory_tabs is off. */}
      <TabStrip
        ariaLabel="Inventory view"
        activeTab={tabFromUrl}
        tabs={[
          { id: '',        label: 'All Inventory' },
          { id: 'selling', label: 'All Selling Inventory', visible: canShowInventoryTabs },
          { id: 'rental',  label: 'All Rental Inventory',  visible: canShowInventoryTabs },
          { id: 'dead',    label: 'Dead Inventory',        visible: canShowInventoryTabs },
        ]}
        onSelect={(nextTab) => {
          const params = new URLSearchParams(searchParams.toString());
          if (nextTab) params.set('tab', nextTab);
          else params.delete('tab');
          // Reset paging on tab change.
          params.set('page', '1');
          // Tab and granular filter are mutually exclusive when they pin
          // the same field; clear those granular params on tab switch so
          // the new tab's slice isn't muddled by stale chips.
          params.delete('listingType');
          params.delete('priceMin');
          params.delete('priceMax');
          if (nextTab === 'dead') params.delete('status');
          router.push(`/dashboard/inventory?${params.toString()}`);
        }}
      />

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100
          flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={14} className="text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">
              Inventory
              {!loading && (
                <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100
                  px-2 py-0.5 rounded-full">
                  {properties.length}
                </span>
              )}
            </h3>
          </div>

          {filtersFromUrl.search && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50
              border border-blue-100 px-2.5 py-1 rounded-full font-medium">
              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                &quot;{filtersFromUrl.search}&quot;
              </span>
              <Button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('search');
                  router.push(`/dashboard/inventory?${params.toString()}`);
                }}
                className="hover:text-blue-800 shrink-0"
              >
                <X size={12} />
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-12 sm:py-16">
            <Loader message="Loading inventory..." />
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-3 px-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gray-50
              flex items-center justify-center">
              <Building2 size={22} className="text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-sm font-medium">
                {filtersFromUrl.search
                  ? `No results for "${filtersFromUrl.search}"`
                  : tabFromUrl === 'selling'
                  ? 'No selling inventory'
                  : tabFromUrl === 'rental'
                  ? 'No rental inventory'
                  : tabFromUrl === 'dead'
                  ? 'No sold inventory'
                  : 'No inventory yet'}
              </p>
              {(activeFilterCount > 0 || tabFromUrl) && (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/inventory')}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
            {!filtersFromUrl.search && activeFilterCount === 0 && !tabFromUrl && (
              <Link href="/dashboard/inventory/add">
                <button type="button" className="text-xs text-blue-600 hover:underline font-semibold">
                  + Add your first inventory item
                </button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <PropertyTable
                properties={properties}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
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

      {/* F13 — Bulk import modal. Mounted only when the feature is on so
          the heavy exceljs import isn't pulled into the bundle for plans
          that don't have access. */}
      {canBulkImportInventory && (
        <PropertyBulkImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImported={() => fetchProperties()}
        />
      )}
    </div>
  );
}

