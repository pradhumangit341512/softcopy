'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { PropertyForm, type PropertyFormValues } from '@/components/properties/PropertyForm';
import { useToast } from '@/components/common/Toast';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import type { Property } from '@/lib/types';

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { addToast } = useToast();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/properties/${id}`, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch property');
        }
        const data = await res.json();
        setProperty(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch property';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  const handleSubmit = async (data: PropertyFormValues) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update property');
      }

      addToast({ type: 'success', message: 'Property updated successfully!' });
      router.push('/dashboard/inventory');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update property';
      addToast({ type: 'error', message: msg });
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4 sm:py-6 lg:py-8 flex items-center justify-center min-h-[40vh]">
        <Loader size="lg" message="Loading property..." />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="py-4 sm:py-6 lg:py-8 space-y-4">
        <Alert type="error" title="Error" message={error || 'Property not found'} />
        <Link href="/dashboard/inventory">
          <Button variant="outline" size="sm" icon={<ArrowLeft size={18} />}>
            Back to Properties
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/dashboard/inventory">
          <Button variant="outline" size="sm" icon={<ArrowLeft size={18} />}>
            <span className="hidden sm:inline">Back</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            Edit Property
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {property.propertyName} — {property.propertyType}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="Property Information" />
        <CardBody>
          <PropertyForm
            onSubmit={handleSubmit}
            initialData={property ? {
              ...property,
              propertyType: property.propertyType as string,
              status: property.status as string,
              askingRent: property.askingRent != null ? String(property.askingRent) : undefined,
              sellingPrice: property.sellingPrice != null ? String(property.sellingPrice) : undefined,
            } : undefined}
            isLoading={saving}
          />
        </CardBody>
      </Card>
    </div>
  );
}
