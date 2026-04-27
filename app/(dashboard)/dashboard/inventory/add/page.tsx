'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { PropertyForm, type PropertyFormValues } from '@/components/properties/PropertyForm';
import { useToast } from '@/components/common/Toast';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';

export default function AddPropertyPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: PropertyFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add property');
      }

      addToast({
        type: 'success',
        message: 'Property added successfully!',
      });
      router.push('/dashboard/inventory');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add property';
      addToast({
        type: 'error',
        message: msg,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/dashboard/inventory">
          <Button variant="outline" size="sm" icon={<ArrowLeft size={18} />}>
            <span className="hidden sm:inline">Back</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Add New Property</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Fill in the property and owner details
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader title="Property Information" />
        <CardBody>
          {loading ? (
            <Loader size="md" message="Saving..." />
          ) : (
            <PropertyForm onSubmit={handleSubmit} isLoading={loading} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
