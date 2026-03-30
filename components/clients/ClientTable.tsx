'use client';

import { Edit2, Trash2 } from 'lucide-react';
import Badge from '@/components/common/Badge';
import { formatCurrency } from '@/lib/utils';
import Button from '@/components/common/ Button';

import type { Client } from '@/lib/types';

interface ClientTableProps {
  clients: Client[];
  onEdit: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}

const formatDate = (date?: Date | string | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function ClientTable({ clients, onEdit, onDelete }: ClientTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm min-w-[1200px]">

        {/* ── HEADER ── */}
        <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-semibold tracking-wider">
          <tr>
            <th className="px-3 sm:px-4 py-3 text-center w-20">Actions</th>
            <th className="px-3 sm:px-4 py-3 text-left">Client Name</th>
            <th className="px-3 sm:px-4 py-3 text-left">Phone</th>
            <th className="px-3 sm:px-4 py-3 text-left">Email</th>
            <th className="px-3 sm:px-4 py-3 text-left">Requirement</th>
            <th className="px-3 sm:px-4 py-3 text-left">Inquiry</th>
            <th className="px-3 sm:px-4 py-3 text-left">Status</th>
            <th className="px-3 sm:px-4 py-3 text-left">Visited</th>
            <th className="px-3 sm:px-4 py-3 text-left">Budget</th>
            <th className="px-3 sm:px-4 py-3 text-left">Location</th>
            <th className="px-3 sm:px-4 py-3 text-left">Address</th>
            <th className="px-3 sm:px-4 py-3 text-left">Visit Date</th>
            <th className="px-3 sm:px-4 py-3 text-left">Follow Up</th>
            <th className="px-3 sm:px-4 py-3 text-left">Source</th>
            <th className="px-3 sm:px-4 py-3 text-left">Notes</th>
          </tr>
        </thead>

        {/* ── BODY ── */}
        <tbody className="divide-y divide-gray-100 bg-white">
          {clients.length === 0 ? (
            <tr>
              <td colSpan={15} className="text-center py-12 text-gray-400 text-sm">
                No clients found
              </td>
            </tr>
          ) : (
            clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-gray-50 transition-colors duration-150"
              >

                {/* ACTIONS */}
                <td className="px-3 sm:px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(client.id)}
                      title="Edit client"
                    >
                      <Edit2 size={14} />
                    </Button>

                    {onDelete && (
                      <button
                        onClick={() => onDelete(client.id)}
                        title="Delete client"
                        className="w-7 h-7 rounded-lg border border-red-100 bg-red-50
                          flex items-center justify-center text-red-400
                          hover:bg-red-100 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>

                {/* CLIENT NAME */}
                <td className="px-3 sm:px-4 py-3">
                  <p className="font-semibold text-gray-900 leading-tight">
                    {client.clientName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {client.creator?.name ? `by ${client.creator.name}` : '—'}
                  </p>
                </td>

                {/* PHONE */}
                <td className="px-3 sm:px-4 py-3 text-gray-900 whitespace-nowrap">
                  {client.phone}
                </td>

                {/* EMAIL */}
                <td className="px-3 sm:px-4 py-3">
                  <span className="text-gray-700 truncate block max-w-[180px]">
                    {client.email || '—'}
                  </span>
                </td>

                {/* REQUIREMENT TYPE */}
                <td className="px-3 sm:px-4 py-3">
                  <Badge label={client.requirementType} variant="primary" />
                </td>

                {/* INQUIRY TYPE */}
                <td className="px-3 sm:px-4 py-3">
                  <Badge
                    label={client.inquiryType}
                    variant={
                      client.inquiryType === 'Buy'
                        ? 'success'
                        : client.inquiryType === 'Rent'
                        ? 'warning'
                        : 'gray'
                    }
                  />
                </td>

                {/* STATUS */}
                <td className="px-3 sm:px-4 py-3">
                  <Badge
                    label={client.status}
                    variant={
                      client.status === 'DealDone'
                        ? 'success'
                        : client.status === 'Rejected'
                        ? 'danger'
                        : client.status === 'Interested'
                        ? 'warning'
                        : 'primary'
                    }
                  />
                </td>

                {/* PROPERTY VISITED */}
                <td className="px-3 sm:px-4 py-3">
                  <Badge
                    label={client.propertyVisited ? 'Yes' : 'No'}
                    variant={client.propertyVisited ? 'success' : 'gray'}
                  />
                </td>

                {/* BUDGET */}
                <td className="px-3 sm:px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {client.budget ? formatCurrency(client.budget) : '—'}
                </td>

                {/* PREFERRED LOCATION */}
                <td className="px-3 sm:px-4 py-3 text-gray-700">
                  <span className="truncate block max-w-[140px]">
                    {client.preferredLocation || '—'}
                  </span>
                </td>

                {/* ADDRESS */}
                <td className="px-3 sm:px-4 py-3 text-gray-700">
                  <span className="truncate block max-w-[160px]">
                    {client.address || '—'}
                  </span>
                </td>

                {/* VISITING DATE */}
                <td className="px-3 sm:px-4 py-3 text-gray-700 whitespace-nowrap">
                  {formatDate(client.visitingDate)}
                </td>

                {/* FOLLOW UP DATE */}
                <td className="px-3 sm:px-4 py-3 text-gray-700 whitespace-nowrap">
                  {formatDate(client.followUpDate)}
                </td>

                {/* SOURCE */}
                <td className="px-3 sm:px-4 py-3 text-gray-700">
                  {client.source || '—'}
                </td>

                {/* NOTES */}
                <td className="px-3 sm:px-4 py-3 text-gray-600">
                  <span className="truncate block max-w-[180px]" title={client.notes || ''}>
                    {client.notes || '—'}
                  </span>
                </td>

              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
