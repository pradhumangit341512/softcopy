'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Card, { CardBody, CardHeader } from '@/components/common/Card';
import ClientForm from '@/components/clients/ClientForm';
import ActivityTimeline from '@/components/clients/ActivityTimeline';
import { useClients } from '@/hooks/useClients';
import { useToast } from '@/components/common/Toast';
import Loader from '@/components/common/Loader';
import Button from '@/components/common/ Button';
import { Client } from '@/lib/types';

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const { updateClient, loading: saving, error } = useClients();
  const { addToast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const clientId = params.id as string;

  useEffect(() => {
    if (!clientId) return;

    const fetchClient = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/clients/${clientId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to fetch client');
        }
        const data = await res.json();
        setClient(data.client || data);
      } catch (err: any) {
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientId]);

  const handleSubmit = async (data: any) => {
    const success = await updateClient(clientId, data);
    if (success) {
      addToast({
        type: 'success',
        message: 'Client updated successfully!',
      });
      router.push('/dashboard/clients');
    } else {
      addToast({
        type: 'error',
        message: error || 'Failed to update client',
      });
    }
    return success;
  };

  if (loading) {
    return (
      <div className="py-8">
        <Loader fullScreen size="lg" message="Loading client..." />
      </div>
    );
  }

  if (fetchError || !client) {
    return (
      <div className="py-4 sm:py-6 lg:py-8 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clients">
            <Button variant="outline" size="sm" icon={<ArrowLeft size={18} />}>
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Client Not Found</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <p className="text-gray-500">{fetchError || 'Could not find this client.'}</p>
          <Link href="/dashboard/clients">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/dashboard/clients">
          <Button variant="outline" size="sm" icon={<ArrowLeft size={18} />}>
            <span className="hidden sm:inline">Back</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            Edit Client
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Update details for {client.clientName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Form Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Client Information" />
            <CardBody>
              {saving ? (
                <Loader size="md" message="Saving..." />
              ) : (
                <ClientForm
                  onSubmit={handleSubmit}
                  initialData={client}
                  isLoading={saving}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Activity Timeline */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader title="Activity Timeline" />
            <CardBody>
              <ActivityTimeline clientId={clientId} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
