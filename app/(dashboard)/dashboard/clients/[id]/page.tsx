'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import Card, { CardBody, CardHeader } from '@/components/common/Card';
import { useClients } from '@/hooks/useClients';
import { useToast } from '@/components/common/Toast';
import Loader from '@/components/common/Loader';
import Alert from '@/components/common/Alert';
import Button from '@/components/common/ Button';

import type { Client } from '@/lib/types';
import ClientForm from '@/components/clients/ClientForm';

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const { updateClient, deleteClient, loading } = useClients();
  const { addToast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (clientId) fetchClient();
  }, [clientId]);

  const fetchClient = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch client');
      }

      const data: Client = await response.json();
      setClient(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    const success = await updateClient(clientId, formData);

    if (success) {
      addToast({
        type: 'success',
        message: 'Client updated successfully!',
      });
      fetchClient();
    } else {
      addToast({
        type: 'error',
        message: 'Failed to update client',
      });
    }

    return success;
  };

  const handleDelete = async () => {
    const success = await deleteClient(clientId);

    if (success) {
      addToast({
        type: 'success',
        message: 'Client deleted successfully!',
      });
      router.push('/dashboard/clients');
    } else {
      addToast({
        type: 'error',
        message: 'Failed to delete client',
      });
    }
  };

  if (fetchLoading) {
    return <Loader fullScreen size="lg" message="Loading client..." />;
  }

  if (error || !client) {
    return (
      <div className="py-8">
        <Alert
          type="error"
          title="Error"
          message={error || 'Client not found'}
        />
        <Link href="/dashboard/clients" className="mt-4">
          <Button variant="outline">Back to Clients</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/clients">
            <Button variant="outline" size="sm" icon={<ArrowLeft size={18} />}>
              Back
            </Button>
          </Link>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {client.clientName}
            </h1>
            <p className="text-gray-600 mt-1">{client.phone}</p>
          </div>
        </div>

        {/* Delete Button */}
        {showDeleteConfirm ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={loading}
            >
              Confirm Delete
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Client
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {client.status}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Inquiry Type</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {client.inquiryType}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Budget</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {client.budget ? `₹${client.budget.toLocaleString()}` : 'N/A'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader title="Edit Client Details" />
        <CardBody>
          <ClientForm
            onSubmit={handleSubmit}
            initialData={{
              ...client,
              visitingDate: client.visitingDate
                ? new Date(client.visitingDate).toISOString().split('T')[0]
                : undefined,
              followUpDate: client.followUpDate
                ? new Date(client.followUpDate).toISOString().split('T')[0]
                : undefined,
            }}
            isLoading={loading}
          />
        </CardBody>
      </Card>
    </div>
  );
}