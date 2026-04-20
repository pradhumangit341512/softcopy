'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { ClientForm } from '@/components/clients/ClientForm';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import type { Client } from '@/lib/types';
import type { ClientFormData } from '@/hooks/useClients';

interface TeamMember { id: string; name: string }

export default function AddClientPage() {
  const router = useRouter();
  const { addClient, loading } = useClients();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/users?limit=100', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = d.users ?? d;
        if (Array.isArray(list)) {
          setTeamMembers(list.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
        }
      })
      .catch(() => {});
  }, [isAdmin]);

  const handleSubmit = async (data: Partial<Client> & { assignedTo?: string }) => {
    const formData = {
      ...data,
      visitingDate: data.visitingDate instanceof Date ? data.visitingDate.toISOString() : data.visitingDate as string | undefined,
      followUpDate: data.followUpDate instanceof Date ? data.followUpDate.toISOString() : data.followUpDate as string | undefined,
    };
    const success = await addClient(formData as ClientFormData);
    if (success) {
      // Invalidate the cached /dashboard/clients RSC so the list refetches
      // the newly created record after navigation.
      router.refresh();
      router.push('/dashboard/clients');
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
            <ClientForm
              onSubmit={handleSubmit}
              isLoading={loading}
              isAdmin={isAdmin}
              teamMembers={teamMembers}
              currentUserId={user?.id}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}