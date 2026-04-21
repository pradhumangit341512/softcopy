'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/common/Button';

import type { Property } from '@/lib/types';

interface PropertyTableProps {
  properties: Property[];
  onEdit: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}

export function PropertyTable({ properties, onEdit, onDelete }: PropertyTableProps) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50/80 text-gray-500 uppercase text-[11px] font-semibold tracking-wider
        border-b border-gray-100 sticky top-0">
        <tr>
          <th className="px-3 py-2.5 text-center w-[72px]">Actions</th>
          <th className="px-3 py-2.5 text-left min-w-[140px]">Property</th>
          <th className="px-3 py-2.5 text-left min-w-[90px]">Type</th>
          <th className="px-3 py-2.5 text-left min-w-[130px]">Address</th>
          <th className="px-3 py-2.5 text-left min-w-[100px]">Owner</th>
          <th className="px-3 py-2.5 text-left min-w-[120px]">Contact</th>
          <th className="px-3 py-2.5 text-right min-w-[90px]">Rent</th>
          <th className="px-3 py-2.5 text-right min-w-[100px]">Sale Price</th>
          <th className="px-3 py-2.5 text-left min-w-[70px]">Area</th>
          <th className="px-3 py-2.5 text-left min-w-[90px]">Vacate</th>
          <th className="px-3 py-2.5 text-left min-w-[85px]">Status</th>
          <th className="px-3 py-2.5 text-left min-w-[80px]">Added</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-50">
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
              className="hover:bg-blue-50/30 transition-colors duration-100"
            >
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(property.id)}
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </Button>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(property.id)}
                      title="Delete"
                      className="w-7 h-7 rounded-lg border border-red-100 bg-red-50
                        flex items-center justify-center text-red-400
                        hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>

              <td className="px-3 py-2.5">
                <p className="font-semibold text-gray-900 leading-tight truncate max-w-[180px]">
                  {property.propertyName}
                </p>
                {property.description && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[180px]">
                    {property.description}
                  </p>
                )}
              </td>

              <td className="px-3 py-2.5">
                <Badge label={property.propertyType} variant="primary" />
                {property.bhkType && (
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">{property.bhkType}</p>
                )}
              </td>

              <td className="px-3 py-2.5 text-gray-600 truncate max-w-[160px]">
                {property.address}
              </td>

              <td className="px-3 py-2.5">
                <p className="font-medium text-gray-900 truncate max-w-[120px]">{property.ownerName}</p>
              </td>

              <td className="px-3 py-2.5">
                <p className="text-gray-800 text-xs">{property.ownerPhone}</p>
                {property.ownerEmail && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[130px]">
                    {property.ownerEmail}
                  </p>
                )}
              </td>

              <td className="px-3 py-2.5 text-right font-medium text-gray-800 whitespace-nowrap">
                {property.askingRent ? formatCurrency(property.askingRent) : '—'}
              </td>

              <td className="px-3 py-2.5 text-right font-medium text-gray-800 whitespace-nowrap">
                {property.sellingPrice ? formatCurrency(property.sellingPrice) : '—'}
              </td>

              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                {property.area || '—'}
              </td>

              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                {property.vacateDate
                  ? new Date(property.vacateDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </td>

              <td className="px-3 py-2.5">
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

              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                {formatDate(property.createdAt)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
