'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/common/Toast';

export interface ClientFormData {
  clientName: string;
  phone: string;
  email?: string;
  companyName?: string;
  requirementType: string;
  inquiryType: string;
  budget?: number;
  preferredLocation?: string;
  address?: string;
  visitingDate?: string;
  visitingTime?: string;
  followUpDate?: string;
  status: string;
  source?: string;
  notes?: string;
}

export interface ClientResponse {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  status: string;
  requirementType: string;
  inquiryType: string;
  budget?: number;
  preferredLocation?: string;
  visitingDate?: string;
  visitingTime?: string;
  followUpDate?: string;
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface UseClientsReturn {
  clients: ClientResponse[];
  loading: boolean;
  error: string | null;
  fetchClients: (filters?: any) => Promise<void>;
  getClient: (id: string) => Promise<ClientResponse | null>;
  addClient: (data: ClientFormData) => Promise<boolean>;
  updateClient: (id: string, data: Partial<ClientFormData>) => Promise<boolean>;
  deleteClient: (id: string) => Promise<boolean>;
  searchClients: (query: string) => Promise<ClientResponse[]>;
  exportClients: (type: 'all' | 'filtered' | 'today') => Promise<void>;
}

export function useClients(): UseClientsReturn {
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const router = useRouter();

  const fetchClients = useCallback(async (filters?: any) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.inquiryType) params.append('inquiryType', filters.inquiryType);
      if (filters?.page) params.append('page', filters.page.toString());

      const response = await fetch(`/api/clients?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clients');

      const data = await response.json();
      setClients(data.clients || data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch clients';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const getClient = useCallback(async (id: string): Promise<ClientResponse | null> => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${id}`);
      if (!response.ok) throw new Error('Client not found');
      return await response.json();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch client';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addClient = useCallback(async (data: ClientFormData): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to add client');

      addToast({
        type: 'success',
        message: 'Client added successfully!',
      });

      await fetchClients();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add client';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
      return false;
    } finally {
      setLoading(false);
    }
  }, [addToast, fetchClients]);

  const updateClient = useCallback(
    async (id: string, data: Partial<ClientFormData>): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/clients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Failed to update client');

        addToast({
          type: 'success',
          message: 'Client updated successfully!',
        });

        await fetchClients();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update client';
        setError(errorMsg);
        addToast({ type: 'error', message: errorMsg });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [addToast, fetchClients]
  );

  const deleteClient = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete client');

      addToast({
        type: 'success',
        message: 'Client deleted successfully',
      });

      await fetchClients();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete client';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
      return false;
    } finally {
      setLoading(false);
    }
  }, [addToast, fetchClients]);

  const searchClients = useCallback(async (query: string): Promise<ClientResponse[]> => {
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.clients || [];
    } catch (err) {
      addToast({ type: 'error', message: 'Search failed' });
      return [];
    }
  }, [addToast]);

  const exportClients = useCallback(
    async (type: 'all' | 'filtered' | 'today') => {
      try {
        const response = await fetch(`/api/clients/export?type=${type}`);
        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();

        addToast({
          type: 'success',
          message: 'Clients exported successfully',
        });
      } catch (err) {
        addToast({ type: 'error', message: 'Export failed' });
      }
    },
    [addToast]
  );

  return {
    clients,
    loading,
    error,
    fetchClients,
    getClient,
    addClient,
    updateClient,
    deleteClient,
    searchClients,
    exportClients,
  };
}