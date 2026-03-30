'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Download, Users, SlidersHorizontal, X } from 'lucide-react';

import Loader from '@/components/common/Loader';
import ClientTable from '@/components/clients/ClientTable';
import { useAuth } from '@/hooks/useAuth';
import Alert from '@/components/common/Alert';
import Pagination from '@/components/common/Pagination';

import type { Client } from '@/lib/types';
import ClientFilters from '@/components/clients/ ClientFilters';
import Button from '@/components/common/ Button';

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

  // ── Read everything from URL (single source of truth) ──
  const searchFromUrl  = searchParams.get('search')   || '';
  const statusFromUrl  = searchParams.get('status')   || '';
  const dateFromUrl    = searchParams.get('dateFrom')  || '';
  const dateToUrl      = searchParams.get('dateTo')    || '';
  const pageFromUrl    = parseInt(searchParams.get('page') || '1', 10);

  // Local state for filter UI — synced from URL
  const [filters, setFilters] = useState({
    status:   statusFromUrl,
    search:   searchFromUrl,
    dateFrom: dateFromUrl,
    dateTo:   dateToUrl,
  });

  useEffect(() => {
    setFilters({
      status:   statusFromUrl,
      search:   searchFromUrl,
      dateFrom: dateFromUrl,
      dateTo:   dateToUrl,
    });
  }, [searchFromUrl, statusFromUrl, dateFromUrl, dateToUrl]);

  // Push filter changes to URL
  const handleFilterChange = (newFilters: typeof filters) => {
    const params = new URLSearchParams();
    if (newFilters.search)   params.set('search',   newFilters.search);
    if (newFilters.status)   params.set('status',   newFilters.status);
    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
    if (newFilters.dateTo)   params.set('dateTo',   newFilters.dateTo);
    params.set('page', '1');
    router.push(`/dashboard/clients?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/dashboard/clients?${params.toString()}`);
  };

  // Count active filters for badge
  const activeFilterCount = [statusFromUrl, dateFromUrl, dateToUrl].filter(Boolean).length;

  // ── Fetch clients ──
  const fetchClients = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(searchFromUrl && { search:   searchFromUrl }),
        ...(statusFromUrl && { status:   statusFromUrl }),
        ...(dateFromUrl   && { dateFrom: dateFromUrl }),
        ...(dateToUrl     && { dateTo:   dateToUrl }),
        page: String(pageFromUrl),
      });
      const response = await fetch(`/api/clients?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      setClients(data.clients || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  }, [user?.id, searchFromUrl, statusFromUrl, dateFromUrl, dateToUrl, pageFromUrl]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchClients();
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

  const handleEdit   = (id: string) => router.push(`/dashboard/clients/${id}`);
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client?')) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      fetchClients();
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">

      {/* ══ HEADER ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Clients
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

          {/* Export */}
          <button
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

          {/* Add client */}
          <Link href="/dashboard/clients/add">
            <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
              rounded-xl shadow-sm transition-colors whitespace-nowrap">
              <Plus size={15} />
              <span className="hidden sm:inline">Add Client</span>
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
              Clients
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
                  router.push(`/dashboard/clients?${params.toString()}`);
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
                {searchFromUrl ? `No results for "${searchFromUrl}"` : 'No clients yet'}
              </p>
              {(statusFromUrl || dateFromUrl || dateToUrl) && (
                <button
                  onClick={() => router.push('/dashboard/clients')}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
            {!searchFromUrl && !statusFromUrl && (
              <Link href="/dashboard/clients/add">
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
              <div className="min-w-[600px]">
                <ClientTable
                  clients={clients}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
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

    </div>
  );
}