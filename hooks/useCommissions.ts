'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/common/Toast';

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
  fetchCommissions: (filters?: any) => Promise<void>;
  createCommission: (data: {
    clientId: string;
    userId: string;
    dealAmount: number;
    commissionPercentage: number;
  }) => Promise<boolean>;
  markAsPaid: (id: string) => Promise<boolean>;
  deleteCommission: (id: string) => Promise<boolean>;
}

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

  const fetchCommissions = useCallback(async (filters?: any) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters?.paidStatus) params.append('paidStatus', filters.paidStatus);
      if (filters?.userId) params.append('userId', filters.userId);

      const response = await fetch(`/api/commissions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setCommissions(data.commissions || []);
      setSummary(data.totals || {
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch commissions';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const createCommission = useCallback(
    async (data: {
      clientId: string;
      userId: string;
      dealAmount: number;
      commissionPercentage: number;
    }): Promise<boolean> => {
      try {
        setLoading(true);

        const response = await fetch('/api/commissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Failed to create');

        addToast({
          type: 'success',
          message: 'Commission created successfully',
        });

        await fetchCommissions();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create commission';
        addToast({ type: 'error', message: errorMsg });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [addToast, fetchCommissions]
  );

  const markAsPaid = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/commissions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paidStatus: 'Paid' }),
        });

        if (!response.ok) throw new Error('Failed to update');

        addToast({
          type: 'success',
          message: 'Commission marked as paid',
        });

        await fetchCommissions();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update';
        addToast({ type: 'error', message: errorMsg });
        return false;
      }
    },
    [addToast, fetchCommissions]
  );

  const deleteCommission = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/commissions/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete');

        addToast({
          type: 'success',
          message: 'Commission deleted',
        });

        await fetchCommissions();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete';
        addToast({ type: 'error', message: errorMsg });
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