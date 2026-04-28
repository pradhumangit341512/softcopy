'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/lib/fetch';

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

interface ListResponse {
  clients: ClientResponse[];
  pagination?: { total: number; page: number; pages: number };
}

/**
 * CRUD hook for clients. All requests go through `authFetch` so:
 *   - 401 auto-redirects to /login (no per-call handling)
 *   - 402 (subscription expired) auto-redirects with banner
 *   - errors come back as typed ApiError with `code`, `fields`, `requestId`
 *   - 15s timeout prevents hung UI
 */
export function useClients() {
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const messageOf = (err: unknown, fallback: string): string =>
    err instanceof ApiError ? err.message : fallback;

  const fetchClients = useCallback(
    async (filters?: { search?: string; status?: string; page?: number }) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filters?.search) params.append('search', filters.search);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.page) params.append('page', String(filters.page));

        const data = await api.get<ListResponse>(`/api/clients?${params}`);
        setClients(data.clients ?? []);
      } catch (err) {
        const msg = messageOf(err, 'Failed to fetch clients');
        setError(msg);
        addToast({ type: 'error', message: msg });
      } finally {
        setLoading(false);
      }
    },
    [addToast]
  );

  const getClient = useCallback(async (id: string) => {
    try {
      setLoading(true);
      return await api.get<ClientResponse>(`/api/clients/${id}`);
    } catch (err) {
      setError(messageOf(err, 'Client not found'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addClient = useCallback(
    async (data: ClientFormData) => {
      try {
        setLoading(true);
        setError(null);
        await api.post('/api/clients', data);
        addToast({ type: 'success', message: 'Client added successfully!' });
        return true;
      } catch (err) {
        const msg = messageOf(err, 'Failed to add Leads');
        setError(msg);
        addToast({ type: 'error', message: msg });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [addToast]
  );

  const updateClient = useCallback(
    async (id: string, data: Partial<ClientFormData>) => {
      try {
        setLoading(true);
        setError(null);
        await api.put(`/api/clients/${id}`, data);
        addToast({ type: 'success', message: 'Client updated successfully!' });
        return true;
      } catch (err) {
        const msg = messageOf(err, 'Failed to update client');
        setError(msg);
        addToast({ type: 'error', message: msg });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [addToast]
  );

  const deleteClient = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setError(null);
        await api.del(`/api/clients/${id}`);
        addToast({ type: 'success', message: 'Client deleted successfully!' });
        return true;
      } catch (err) {
        const msg = messageOf(err, 'Failed to delete client');
        setError(msg);
        addToast({ type: 'error', message: msg });
        return false;
      } finally {
        setLoading(false);
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
    searchClients: async () => [],
    exportClients: async () => {},
  };
}
