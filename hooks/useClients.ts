'use client';

import { useState, useCallback } from 'react';
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

export function useClients() {
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // ================= FETCH CLIENTS =================
  const fetchClients = useCallback(async (filters?: any) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.page) params.append('page', filters.page.toString());

      const response = await fetch(`/api/clients?${params}`, {
        credentials: 'include', // ✅ IMPORTANT
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch clients');
      }

      const data = await response.json();
      setClients(data.clients || data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch clients';
      setError(errorMsg);
      addToast({ type: 'error', message: errorMsg });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // ================= GET CLIENT =================
  const getClient = useCallback(async (id: string) => {
    try {
      setLoading(true);

      const response = await fetch(`/api/clients/${id}`, {
        credentials: 'include', // ✅ IMPORTANT
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Client not found');
      }

      return await response.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ================= ADD CLIENT =================
  const addClient = useCallback(async (data: ClientFormData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ✅ IMPORTANT
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add client');
      }

      addToast({ type: 'success', message: 'Client added successfully!' });

      return true;
    } catch (err: any) {
      setError(err.message);
      addToast({ type: 'error', message: err.message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // ================= UPDATE CLIENT =================
  const updateClient = useCallback(async (id: string, data: Partial<ClientFormData>) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ✅ IMPORTANT FIX
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update client');
      }

      addToast({ type: 'success', message: 'Client updated successfully!' });

      return true;
    } catch (err: any) {
      setError(err.message);
      addToast({ type: 'error', message: err.message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // ================= DELETE CLIENT =================
  const deleteClient = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        credentials: 'include', // ✅ IMPORTANT
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete client');
      }

      addToast({ type: 'success', message: 'Client deleted successfully!' });

      return true;
    } catch (err: any) {
      setError(err.message);
      addToast({ type: 'error', message: err.message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

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