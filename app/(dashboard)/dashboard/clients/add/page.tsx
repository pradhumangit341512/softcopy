'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Card, { CardBody, CardHeader } from '@/components/common/Card';
import ClientForm from '@/components/clients/ClientForm';
import { useClients } from '@/hooks/useClients';
import { useToast } from '@/components/common/Toast';
import Loader from '@/components/common/Loader';
import Button from '@/components/common/ Button';

export default function AddClientPage() {
  const router = useRouter();
  const { addClient, loading, error } = useClients();
  const { addToast } = useToast();

  const handleSubmit = async (data: any) => {
    const success = await addClient(data);
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
    <div className="py-8 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/clients">
          <Button variant="outline" size="sm" icon={<ArrowLeft size={18} />}>
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Client</h1>
          <p className="text-gray-600 mt-1">
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