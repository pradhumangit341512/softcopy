'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { ClientForm } from '@/components/clients/ClientForm';
import { useClients } from '@/hooks/useClients';
import { useToast } from '@/components/common/Toast';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import type { Client } from '@/lib/types';
import type { ClientFormData } from '@/hooks/useClients';

export default function AddClientPage() {
  const router = useRouter();
  const { addClient, loading, error } = useClients();
  const { addToast } = useToast();

  const handleSubmit = async (data: Partial<Client>) => {
    const formData = {
      ...data,
      visitingDate: data.visitingDate instanceof Date ? data.visitingDate.toISOString() : data.visitingDate as string | undefined,
      followUpDate: data.followUpDate instanceof Date ? data.followUpDate.toISOString() : data.followUpDate as string | undefined,
    };
    const success = await addClient(formData as ClientFormData);
    if (success) {
      addToast({
        type: 'success',
        message: 'Client added successfully!',
      });
      router.push('/dashboard/clients');
    } else {
      addToast({
        type: 'error',
        message: error || 'Failed to add client',
      });
    }
    return success;
  };

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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Add New Client</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Fill in the details to add a new property lead
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader title="Client Information" />
        <CardBody>
          {loading ? (
            <Loader size="md" message="Saving..." />
          ) : (
            <ClientForm onSubmit={handleSubmit} isLoading={loading} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}