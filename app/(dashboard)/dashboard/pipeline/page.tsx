'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Loader from '@/components/common/Loader';
import {
  Sparkles, UserPlus, ThumbsUp, CheckCircle2, XCircle,
  GripVertical, Phone, MapPin, IndianRupee, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';

interface PipelineClient {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  status: string;
  budget?: number;
  preferredLocation?: string;
  requirementType: string;
  inquiryType: string;
  followUpDate?: string;
  createdAt: string;
}

const COLUMNS = [
  { status: 'New',        label: 'New Leads',   icon: Sparkles,     color: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  { status: 'Interested', label: 'Interested',  icon: ThumbsUp,     color: 'amber',  bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  { status: 'DealDone',   label: 'Deal Done',   icon: CheckCircle2, color: 'green',  bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
  { status: 'Rejected',   label: 'Rejected',    icon: XCircle,      color: 'red',    bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700' },
];

function formatCurrency(amount: number) {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return amount.toLocaleString('en-IN');
}

export default function PipelinePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [clients, setClients] = useState<PipelineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAllClients = useCallback(async () => {
    try {
      // Fetch all pages of clients
      let allClients: PipelineClient[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await fetch(`/api/clients?page=${page}`, { credentials: 'include' });
        if (!res.ok) break;
        const data = await res.json();
        allClients = [...allClients, ...data.clients];
        hasMore = page < data.pagination.pages;
        page++;
      }
      setClients(allClients);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllClients(); }, [fetchAllClients]);

  const updateClientStatus = async (clientId: string, newStatus: string) => {
    setUpdatingId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
        );
        addToast({ type: 'success', message: `Moved to ${newStatus}` });
      } else {
        addToast({ type: 'error', message: 'Failed to update status' });
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to update status' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    e.dataTransfer.setData('clientId', clientId);
    setDraggingId(clientId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const clientId = e.dataTransfer.getData('clientId');
    const client = clients.find((c) => c.id === clientId);
    if (client && client.status !== targetStatus) {
      updateClientStatus(clientId, targetStatus);
    }
    setDraggingId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  if (loading) {
    return <Loader fullScreen size="lg" message="Loading pipeline..." />;
  }

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight">
            Deal Pipeline
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Drag and drop clients between stages to update their status
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-semibold text-gray-700">{clients.length}</span> total leads
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[60vh]">
        {COLUMNS.map((col) => {
          const colClients = clients.filter((c) => c.status === col.status);
          const Icon = col.icon;

          return (
            <div
              key={col.status}
              className={clsx(
                'rounded-2xl border-2 border-dashed p-3 transition-colors duration-200',
                draggingId ? 'border-gray-300 bg-gray-50/50' : `${col.border} ${col.bg}`
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', col.badge)}>
                    <Icon size={14} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">{col.label}</h3>
                </div>
                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', col.badge)}>
                  {colClients.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {colClients.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    Drop leads here
                  </div>
                ) : (
                  colClients.map((client) => (
                    <div
                      key={client.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, client.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                      className={clsx(
                        'bg-white rounded-xl border border-gray-100 p-3 cursor-grab active:cursor-grabbing',
                        'hover:shadow-md transition-all duration-150',
                        'group',
                        draggingId === client.id && 'opacity-50 scale-95',
                        updatingId === client.id && 'animate-pulse'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {client.clientName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              <Phone size={10} /> {client.phone}
                            </span>
                          </div>
                        </div>
                        <GripVertical size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5" />
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                          {client.requirementType}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                          {client.inquiryType}
                        </span>
                        {client.budget && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 flex items-center gap-0.5">
                            <IndianRupee size={8} /> {formatCurrency(client.budget)}
                          </span>
                        )}
                      </div>

                      {client.preferredLocation && (
                        <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-0.5 truncate">
                          <MapPin size={9} /> {client.preferredLocation}
                        </p>
                      )}

                      {/* Quick move buttons */}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {COLUMNS.filter((c) => c.status !== col.status).map((target) => {
                          const TIcon = target.icon;
                          return (
                            <button
                              key={target.status}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateClientStatus(client.id, target.status);
                              }}
                              title={`Move to ${target.label}`}
                              className={clsx(
                                'flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                                'border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-800 transition-colors'
                              )}
                            >
                              <ArrowRight size={8} />
                              <TIcon size={9} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
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
