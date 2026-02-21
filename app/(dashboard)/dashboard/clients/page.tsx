'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Download, Filter } from 'lucide-react';
import Card, { CardBody, CardHeader } from '@/components/common/Card';
import Loader from '@/components/common/Loader';
import ClientTable from '@/components/clients/ClientTable';
import { useAuth } from '@/hooks/useAuth';
import Alert from '@/components/common/Alert';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/common/ Button';
import ClientFilters from '@/components/clients/ ClientFilters';

interface Client {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  requirementType: string;
  inquiryType: string;
  budget?: number;
  status: string;
  visitingDate?: string;
  creator: { name: string };
}

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchClients();
  }, [filters, page]);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        page: String(page),
      });

      const response = await fetch(`/api/clients?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clients');

      const data = await response.json();
      setClients(data.clients || data);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/clients/export?type=filtered');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clients.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export clients');
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      fetchClients();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">Manage all your property leads</p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            icon={<Download size={18} />}
          >
            Export
          </Button>
          <Link href="/dashboard/clients/add">
            <Button icon={<Plus size={18} />}>Add Client</Button>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader title="Filters" />
        <CardBody>
          <ClientFilters
            filters={filters}
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              setPage(1); // Reset to first page
            }}
          />
        </CardBody>
      </Card>

      {/* Clients Table Card */}
      <Card>
        <CardHeader title={`Clients (${clients.length})`} />
        <CardBody>
          {loading ? (
            <Loader size="md" message="Loading clients..." />
          ) : clients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No clients found</p>
              <Link href="/dashboard/clients/add">
                <Button className="mt-4" size="sm">
                  Add Your First Client
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <ClientTable
                clients={clients}
                onEdit={(clientId) =>
                  router.push(`/dashboard/clients/${clientId}`)
                }
                onDelete={handleDelete}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 border-t pt-6">
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
        </CardBody>
      </Card>
    </div>
  );
}