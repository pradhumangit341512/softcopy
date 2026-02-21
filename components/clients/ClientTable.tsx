'use client';

import { Trash2, Edit2, Eye } from 'lucide-react';
import Badge from '@/components/common/Badge';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface Client {
  id: string;
  clientName: string;
  phone: string;
  email?: string;
  requirementType: string;
  inquiryType: string;
  budget?: number;
  status: string;
  creator: { name: string };
}

interface ClientTableProps {
  clients: Client[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ClientTable({
  clients,
  onEdit,
  onDelete,
}: ClientTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
              Client Name
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
              Requirement
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
              Budget
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
              Status
            </th>
            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, index) => (
            <tr
              key={client.id}
              className={`border-b transition hover:bg-gray-50 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <td className="px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">{client.clientName}</p>
                  <p className="text-sm text-gray-500">{client.creator.name}</p>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm">
                  <p className="text-gray-900">{client.phone}</p>
                  <p className="text-gray-500">{client.email || '-'}</p>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm">
                  <p className="text-gray-900">{client.requirementType}</p>
                  <p className="text-gray-500">{client.inquiryType}</p>
                </div>
              </td>
              <td className="px-6 py-4">
                <p className="text-sm font-medium text-gray-900">
                  {client.budget ? formatCurrency(client.budget) : '-'}
                </p>
              </td>
              <td className="px-6 py-4">
                <Badge label={client.status} variant={client.status === 'DealDone' ? 'success' : 'primary'} />
              </td>
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => onEdit(client.id)}
                    className="text-blue-600 hover:text-blue-900 transition"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(client.id)}
                    className="text-red-600 hover:text-red-900 transition"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}