'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp, Phone, IndianRupee, Calendar } from 'lucide-react';

import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate } from '@/lib/utils';

import type { Client } from '@/lib/types';

type PipelineStage = 'New' | 'Interested' | 'DealDone' | 'Rejected';

const STAGES: { key: PipelineStage; label: string; color: string; accent: string }[] = [
  { key: 'New',        label: 'New Leads',   color: 'bg-blue-50 border-blue-200',       accent: 'bg-blue-500'    },
  { key: 'Interested', label: 'Interested',  color: 'bg-amber-50 border-amber-200',     accent: 'bg-amber-500'   },
  { key: 'DealDone',   label: 'Deals Done',  color: 'bg-emerald-50 border-emerald-200', accent: 'bg-emerald-500' },
  { key: 'Rejected',   label: 'Rejected',    color: 'bg-red-50 border-red-200',         accent: 'bg-red-500'     },
];

/**
 * Pipeline page — Kanban-style view of the deal pipeline.
 * Admin sees all company leads; team members see only their own (enforced server-side).
 */
export default function PipelinePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clients?page=1', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch pipeline');
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pipeline');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchClients();
  }, [authLoading, fetchClients, user?.id]);

  /** Group clients by pipeline stage */
  const groupByStage = (stage: PipelineStage): Client[] =>
    clients.filter((c) => c.status === stage);

  const getStageTotal = (stage: PipelineStage): number =>
    groupByStage(stage).reduce((sum, c) => sum + (c.budget ?? 0), 0);

  if (loading) {
    return (
      <div className="py-8">
        <Loader size="lg" message="Loading pipeline..." />
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Deal Pipeline
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {user?.role === 'user'
              ? 'Your leads grouped by stage'
              : 'All company leads grouped by stage'}
            {clients.length > 0 && (
              <span className="ml-1.5 text-gray-400">— {clients.length} total</span>
            )}
          </p>
        </div>

        <Link href="/dashboard/all-leads/add">
          <button
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
              text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
              rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Lead</span>
            <span className="sm:hidden">Add</span>
          </button>
        </Link>
      </div>

      {error && (
        <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />
      )}

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STAGES.map((stage) => {
          const stageClients = groupByStage(stage.key);
          const stageTotal = getStageTotal(stage.key);

          return (
            <div
              key={stage.key}
              className={`rounded-2xl border ${stage.color} flex flex-col min-h-[400px]`}
            >
              {/* Stage header */}
              <div className="px-4 py-3 border-b border-gray-200/60 bg-white/40 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.accent}`} />
                    <h3 className="text-sm font-bold text-gray-800">
                      {stage.label}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 bg-white px-2 py-0.5 rounded-full">
                    {stageClients.length}
                  </span>
                </div>
                {stageTotal > 0 && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <IndianRupee size={11} />
                    {formatCurrency(stageTotal).replace('₹', '')} total
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[600px]">
                {stageClients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <TrendingUp size={20} className="text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">No leads here yet</p>
                  </div>
                ) : (
                  stageClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => router.push(`/dashboard/all-leads/${client.id}`)}
                      className="w-full text-left bg-white rounded-xl p-3 shadow-sm border
                        border-gray-100 hover:shadow-md hover:border-blue-200 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-bold text-gray-900 truncate">
                          {client.clientName}
                        </h4>
                        <Badge
                          label={client.inquiryType}
                          variant="gray"
                          size="sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-gray-600 flex items-center gap-1.5">
                          <Phone size={11} className="text-gray-400 shrink-0" />
                          <span className="truncate">{client.phone}</span>
                        </p>

                        {client.budget ? (
                          <p className="text-xs text-gray-700 font-semibold flex items-center gap-1.5">
                            <IndianRupee size={11} className="text-gray-400 shrink-0" />
                            {formatCurrency(client.budget).replace('₹', '')}
                          </p>
                        ) : null}

                        {client.followUpDate && (
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <Calendar size={11} className="text-gray-400 shrink-0" />
                            {formatDate(client.followUpDate)}
                          </p>
                        )}

                        {client.creator?.name && (
                          <p className="text-xs text-gray-400 pt-1 border-t border-gray-50 mt-2">
                            by {client.creator.name}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
