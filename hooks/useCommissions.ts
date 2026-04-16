'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/lib/fetch';

export interface Commission {
  id: string;
  clientId: string;
  userId: string;
  companyId: string;
  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidStatus: 'Pending' | 'Paid';
  paymentDate?: string;
  createdAt: string;
  client?: { clientName: string };
  user?: { name: string };
}

export interface CommissionSummary {
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
}

interface UseCommissionsReturn {
  commissions: Commission[];
  summary: CommissionSummary;
  loading: boolean;
  error: string | null;
  fetchCommissions: (filters?: { paidStatus?: string; userId?: string }) => Promise<void>;
  createCommission: (data: {
    clientId: string;
    userId: string;
    dealAmount: number;
    commissionPercentage: number;
  }) => Promise<boolean>;
  markAsPaid: (id: string) => Promise<boolean>;
  deleteCommission: (id: string) => Promise<boolean>;
}

interface ListResponse {
  commissions: Commission[];
  totals: CommissionSummary;
}

/**
 * Commissions CRUD hook. Routes through `authFetch` so 401/402 redirects
 * + timeouts + structured ApiError handling are uniform with other hooks.
 */
export function useCommissions(): UseCommissionsReturn {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const messageOf = (err: unknown, fallback: string): string =>
    err instanceof ApiError ? err.message : fallback;

  const fetchCommissions = useCallback(
    async (filters?: { paidStatus?: string; userId?: string }) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filters?.paidStatus) params.append('paidStatus', filters.paidStatus);
        if (filters?.userId) params.append('userId', filters.userId);

        const data = await api.get<ListResponse>(`/api/commissions?${params}`);
        setCommissions(data.commissions ?? []);
        setSummary(
          data.totals ?? { totalCommission: 0, pendingCommission: 0, paidCommission: 0 }
        );
      } catch (err) {
        const msg = messageOf(err, 'Failed to fetch commissions');
        setError(msg);
        addToast({ type: 'error', message: msg });
      } finally {
        setLoading(false);
      }
    },
    [addToast]
  );

  const createCommission = useCallback(
    async (data: {
      clientId: string;
      userId: string;
      dealAmount: number;
      commissionPercentage: number;
    }) => {
      try {
        setLoading(true);
        await api.post('/api/commissions', data);
        addToast({ type: 'success', message: 'Commission created successfully' });
        await fetchCommissions();
        return true;
      } catch (err) {
        addToast({ type: 'error', message: messageOf(err, 'Failed to create commission') });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [addToast, fetchCommissions]
  );

  const markAsPaid = useCallback(
    async (id: string) => {
      try {
        await api.put(`/api/commissions/${id}`, { paidStatus: 'Paid' });
        addToast({ type: 'success', message: 'Commission marked as paid' });
        await fetchCommissions();
        return true;
      } catch (err) {
        addToast({ type: 'error', message: messageOf(err, 'Failed to update') });
        return false;
      }
    },
    [addToast, fetchCommissions]
  );

  const deleteCommission = useCallback(
    async (id: string) => {
      try {
        await api.del(`/api/commissions/${id}`);
        addToast({ type: 'success', message: 'Commission deleted' });
        await fetchCommissions();
        return true;
      } catch (err) {
        addToast({ type: 'error', message: messageOf(err, 'Failed to delete') });
        return false;
      }
    },
    [addToast, fetchCommissions]
  );

  return {
    commissions,
    summary,
    loading,
    error,
    fetchCommissions,
    createCommission,
    markAsPaid,
    deleteCommission,
  };
}
