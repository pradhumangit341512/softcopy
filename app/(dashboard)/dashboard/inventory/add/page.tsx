'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { PropertyForm, type PropertyFormValues } from '@/components/properties/PropertyForm';
import { AddPropertyWizard } from '@/components/properties/AddPropertyWizard';
import { useToast } from '@/components/common/Toast';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import { useFeature } from '@/hooks/useFeature';
import { useAuth } from '@/hooks/useAuth';

interface TeamMember { id: string; name: string; }

export default function AddPropertyPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const useWizard = useFeature('feature.inventory_wizard');
  const [loading, setLoading] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [teammates, setTeammates] = useState<TeamMember[]>([]);

  // Fetch teammates for assignment dropdown (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/users/teammates', { credentials: 'include' })
      .then(async (r) => {
        const j = await r.json();
        if (r.ok && j.teammates) setTeammates(j.teammates);
      })
      .catch(() => {});
  }, [isAdmin]);

  const handleSubmit = async (data: PropertyFormValues) => {
    setLoading(true);
    try {
      const payload = { ...data, ...(assignedTo ? { assignedTo } : {}) };
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add inventory');
      }

      addToast({
        type: 'success',
        message: 'Inventory added successfully!',
      });
      router.push('/dashboard/inventory');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add inventory';
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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Add New Inventory</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Fill in the property and owner details
          </p>
        </div>
      </div>

      {/* Assign to team member (admin only) */}
      {isAdmin && teammates.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Assign to Team Member
            </span>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="mt-1 block w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Myself (default)</option>
              {teammates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.id === user?.id ? '(You)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              This inventory will appear in the selected member&apos;s dashboard
            </p>
          </label>
        </div>
      )}

      {/* Form Card — wizard or single-page form depending on feature gate */}
      <Card>
        <CardHeader title="Inventory Information" />
        <CardBody>
          {loading ? (
            <Loader size="md" message="Saving..." />
          ) : useWizard ? (
            <AddPropertyWizard onSubmit={handleSubmit} isLoading={loading} />
          ) : (
            <PropertyForm onSubmit={handleSubmit} isLoading={loading} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
