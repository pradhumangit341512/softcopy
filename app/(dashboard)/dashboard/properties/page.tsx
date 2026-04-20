'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Building2, SlidersHorizontal, X, Download } from 'lucide-react';

import { Loader } from '@/components/common/Loader';
import { PropertyTable } from '@/components/properties/PropertyTable';
import { PropertyFilters } from '@/components/properties/PropertyFilters';
import { useAuth } from '@/hooks/useAuth';
import { Alert } from '@/components/common/Alert';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/common/Button';

import type { Property } from '@/lib/types';

export default function PropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // Admin-only page — team members don't see properties
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === 'user') {
      router.replace('/dashboard/my-work');
    }
  }, [authLoading, user, router]);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Read from URL
  const searchFromUrl = searchParams.get('search') || '';
  const statusFromUrl = searchParams.get('status') || '';
  const propertyTypeFromUrl = searchParams.get('propertyType') || '';
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);

  const [filters, setFilters] = useState({
    status: statusFromUrl,
    propertyType: propertyTypeFromUrl,
    search: searchFromUrl,
  });

  useEffect(() => {
    setFilters({
      status: statusFromUrl,
      propertyType: propertyTypeFromUrl,
      search: searchFromUrl,
    });
  }, [searchFromUrl, statusFromUrl, propertyTypeFromUrl]);

  const handleFilterChange = (newFilters: typeof filters) => {
    const params = new URLSearchParams();
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.propertyType) params.set('propertyType', newFilters.propertyType);
    params.set('page', '1');
    router.push(`/dashboard/properties?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/dashboard/properties?${params.toString()}`);
  };

  const activeFilterCount = [statusFromUrl, propertyTypeFromUrl].filter(Boolean).length;

  const fetchProperties = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(searchFromUrl && { search: searchFromUrl }),
        ...(statusFromUrl && { status: statusFromUrl }),
        ...(propertyTypeFromUrl && { propertyType: propertyTypeFromUrl }),
        page: String(pageFromUrl),
      });
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
  }, [user?.id, searchFromUrl, statusFromUrl, propertyTypeFromUrl, pageFromUrl]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchProperties();
  }, [authLoading, fetchProperties]);

  const handleEdit = (id: string) => router.push(`/dashboard/properties/${id}`);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) return;
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
      if (searchFromUrl) params.set('search', searchFromUrl);
      if (statusFromUrl) params.set('status', statusFromUrl);
      if (propertyTypeFromUrl) params.set('propertyType', propertyTypeFromUrl);

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
            Properties
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Manage all property listings with owner details
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

          <button
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

          <Link href="/dashboard/properties/add">
            <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
              rounded-xl shadow-sm transition-colors whitespace-nowrap">
              <Plus size={15} />
              <span className="hidden sm:inline">Add Property</span>
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
          />
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100
          flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={14} className="text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">
              Properties
              {!loading && (
                <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100
                  px-2 py-0.5 rounded-full">
                  {properties.length}
                </span>
              )}
            </h3>
          </div>

          {searchFromUrl && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50
              border border-blue-100 px-2.5 py-1 rounded-full font-medium">
              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                &quot;{searchFromUrl}&quot;
              </span>
              <Button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('search');
                  router.push(`/dashboard/properties?${params.toString()}`);
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
            <Loader message="Loading properties..." />
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-3 px-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gray-50
              flex items-center justify-center">
              <Building2 size={22} className="text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-sm font-medium">
                {searchFromUrl ? `No results for "${searchFromUrl}"` : 'No properties yet'}
              </p>
              {(statusFromUrl || propertyTypeFromUrl) && (
                <button
                  onClick={() => router.push('/dashboard/properties')}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
            {!searchFromUrl && !statusFromUrl && (
              <Link href="/dashboard/properties/add">
                <button className="text-xs text-blue-600 hover:underline font-semibold">
                  + Add your first property
                </button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <PropertyTable
                  properties={properties}
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
