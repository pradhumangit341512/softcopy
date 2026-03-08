'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Download, Users } from 'lucide-react';

import Loader from '@/components/common/Loader';
import ClientTable from '@/components/clients/ClientTable';
import { useAuth } from '@/hooks/useAuth';
import Alert from '@/components/common/Alert';
import Pagination from '@/components/common/Pagination';
import ClientFilters from '@/components/clients/ ClientFilters';

import type { Client } from '@/lib/types';

export default function ClientsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ================= FETCH CLIENTS =================
  const fetchClients = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        ...(filters.status   && { status:   filters.status }),
        ...(filters.search   && { search:   filters.search }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo   && { dateTo:   filters.dateTo }),
        page: String(page),
      });

      const response = await fetch(`/api/clients?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch clients');

      const data = await response.json();
      setClients(data.clients || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      console.error('CLIENT FETCH ERROR:', err);
      setError(err.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filters.status, filters.search, filters.dateFrom, filters.dateTo, page]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) return;
    fetchClients();
  }, [authLoading, fetchClients]);

  // ================= EXPORT =================
  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        type: 'filtered',
        ...(filters.status   && { status:   filters.status }),
        ...(filters.search   && { search:   filters.search }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo   && { dateTo:   filters.dateTo }),
      });

      const response = await fetch(`/api/clients/export?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'clients.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError('Failed to export clients');
    } finally {
      setExporting(false);
    }
  };

  // ================= EDIT =================
  const handleEdit = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`);
  };

  // ================= DELETE =================
  const handleDelete = async (clientId: string) => {
    if (!confirm('Delete this client?')) return;
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Delete failed');
      fetchClients();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="py-6 sm:py-8 space-y-5 px-2 sm:px-0">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Clients
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage all your property leads
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium
              text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm
              hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={16} className={exporting ? 'animate-bounce' : ''} />
            <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
          </button>

          {/* Add Client */}
          <Link href="/dashboard/clients/add">
            <button className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold
              text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors">
              <Plus size={16} />
              <span className="hidden sm:inline">Add Client</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* ── FILTERS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
        </div>
        <div className="p-5">
          <ClientFilters
            filters={filters}
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* ── CLIENT TABLE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Table header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
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
        </div>

        {/* Table body */}
        <div className="p-0 sm:p-0">
          {loading ? (
            <div className="py-16">
              <Loader message="Loading clients..." />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <Users size={24} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm font-medium">No clients found</p>
              <Link href="/dashboard/clients/add">
                <button className="text-xs text-blue-600 hover:underline font-semibold">
                  + Add your first client
                </button>
              </Link>
            </div>
          ) : (
            <>
              {/* Horizontal scroll wrapper for table on mobile */}
              <div className="overflow-x-auto">
                <ClientTable
                  clients={clients}
                  onEdit={handleEdit}
                />
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-4 border-t border-gray-100">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    isLoading={loading}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}