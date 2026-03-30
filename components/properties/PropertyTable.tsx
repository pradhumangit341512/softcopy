'use client';

import { Edit2, Trash2 } from 'lucide-react';
import Badge from '@/components/common/Badge';
import { formatCurrency } from '@/lib/utils';
import Button from '@/components/common/ Button';

import type { Property } from '@/lib/types';

interface PropertyTableProps {
  properties: Property[];
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

export default function PropertyTable({ properties, onEdit, onDelete }: PropertyTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm min-w-[900px]">

        {/* HEADER */}
        <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-semibold tracking-wider">
          <tr>
            <th className="px-3 sm:px-4 py-3 text-center w-20">Actions</th>
            <th className="px-3 sm:px-4 py-3 text-left">Property</th>
            <th className="px-3 sm:px-4 py-3 text-left">Type</th>
            <th className="px-3 sm:px-4 py-3 text-left">Address</th>
            <th className="px-3 sm:px-4 py-3 text-left">Owner</th>
            <th className="px-3 sm:px-4 py-3 text-left">Owner Contact</th>
            <th className="px-3 sm:px-4 py-3 text-left">Asking Rent</th>
            <th className="px-3 sm:px-4 py-3 text-left">Selling Price</th>
            <th className="px-3 sm:px-4 py-3 text-left">Area</th>
            <th className="px-3 sm:px-4 py-3 text-left">Vacate Date</th>
            <th className="px-3 sm:px-4 py-3 text-left">Status</th>
            <th className="px-3 sm:px-4 py-3 text-left">Added</th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody className="divide-y divide-gray-100 bg-white">
          {properties.length === 0 ? (
            <tr>
              <td colSpan={12} className="text-center py-12 text-gray-400 text-sm">
                No properties found
              </td>
            </tr>
          ) : (
            properties.map((property) => (
              <tr
                key={property.id}
                className="hover:bg-gray-50 transition-colors duration-150"
              >
                {/* ACTIONS */}
                <td className="px-3 sm:px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(property.id)}
                      title="Edit property"
                    >
                      <Edit2 size={14} />
                    </Button>

                    {onDelete && (
                      <button
                        onClick={() => onDelete(property.id)}
                        title="Delete property"
                        className="w-7 h-7 rounded-lg border border-red-100 bg-red-50
                          flex items-center justify-center text-red-400
                          hover:bg-red-100 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>

                {/* PROPERTY NAME */}
                <td className="px-3 sm:px-4 py-3">
                  <p className="font-semibold text-gray-900 leading-tight">
                    {property.propertyName}
                  </p>
                  {property.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">
                      {property.description}
                    </p>
                  )}
                </td>

                {/* TYPE */}
                <td className="px-3 sm:px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <Badge label={property.propertyType} variant="primary" />
                    {property.bhkType && (
                      <span className="text-xs text-gray-500 font-medium">{property.bhkType}</span>
                    )}
                  </div>
                </td>

                {/* ADDRESS */}
                <td className="px-3 sm:px-4 py-3 text-gray-700 max-w-[160px] truncate">
                  {property.address}
                </td>

                {/* OWNER NAME */}
                <td className="px-3 sm:px-4 py-3">
                  <p className="font-medium text-gray-900">{property.ownerName}</p>
                </td>

                {/* OWNER CONTACT */}
                <td className="px-3 sm:px-4 py-3">
                  <p className="text-gray-900">{property.ownerPhone}</p>
                  {property.ownerEmail && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">
                      {property.ownerEmail}
                    </p>
                  )}
                </td>

                {/* ASKING RENT */}
                <td className="px-3 sm:px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {property.askingRent ? formatCurrency(property.askingRent) : '—'}
                </td>

                {/* SELLING PRICE */}
                <td className="px-3 sm:px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {property.sellingPrice ? formatCurrency(property.sellingPrice) : '—'}
                </td>

                {/* AREA */}
                <td className="px-3 sm:px-4 py-3 text-gray-700 whitespace-nowrap">
                  {property.area || '—'}
                </td>

                {/* VACATE DATE */}
                <td className="px-3 sm:px-4 py-3 text-gray-700 whitespace-nowrap">
                  {property.vacateDate
                    ? new Date(property.vacateDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>

                {/* STATUS */}
                <td className="px-3 sm:px-4 py-3">
                  <Badge
                    label={property.status}
                    variant={
                      property.status === 'Available'
                        ? 'success'
                        : property.status === 'Sold'
                        ? 'primary'
                        : property.status === 'Rented'
                        ? 'warning'
                        : 'danger'
                    }
                  />
                </td>

                {/* ADDED DATE */}
                <td className="px-3 sm:px-4 py-3 text-gray-700 whitespace-nowrap">
                  {formatDate(property.createdAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
