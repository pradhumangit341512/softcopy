'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Button from '../common/ Button';

interface Client {
  id: string;
  clientName: string;
  phone: string;
  email: string;
  status: 'New' | 'Interested' | 'DealDone' | 'Rejected';
  requirementType: string;
  budget: number;
  preferredLocation: string;
  visitingDate?: string;
  followUpDate?: string;
  source?: string;
  notes?: string;
  createdAt: string;
}

interface ClientCardProps {
  client: Client;
  onEdit?: (client: Client) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
}

const statusColors = {
  New: 'bg-blue-100 text-blue-800 border-blue-200',
  Interested: 'bg-green-100 text-green-800 border-green-200',
  DealDone: 'bg-purple-100 text-purple-800 border-purple-200',
  Rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusIcons = {
  New: '🆕',
  Interested: '👁️',
  DealDone: '✅',
  Rejected: '❌',
};

export default function ClientCard({
  client,
  onEdit,
  onDelete,
  onStatusChange,
}: ClientCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (window.confirm(`Delete ${client.clientName}?`)) {
      setIsDeleting(true);
      try {
        onDelete?.(client.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleStatusChange = (newStatus: string) => {
    onStatusChange?.(client.id, newStatus);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN');
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100000).toFixed(2)}L`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5 border border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 truncate">
            {client.clientName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{client.requirementType}</p>
        </div>
        <div className="relative">
          <Button
            onClick={() => setShowActions(!showActions)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M5.5 7a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM8 7a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15.5 7a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </Button>

          {/* Dropdown Menu */}
          {showActions && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
              <Button
                onClick={() => {
                  onEdit?.(client);
                  setShowActions(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
              >
                <span>✏️</span> Edit
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <span>🗑️</span> {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
            statusColors[client.status as keyof typeof statusColors]
          }`}
        >
          {statusIcons[client.status as keyof typeof statusIcons]}{' '}
          {client.status}
        </span>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 w-20">📞</span>
          <a
            href={`tel:${client.phone}`}
            className="text-blue-600 hover:underline"
          >
            {client.phone}
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 w-20">✉️</span>
          <a
            href={`mailto:${client.email}`}
            className="text-blue-600 hover:underline truncate"
          >
            {client.email}
          </a>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Budget */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium mb-1">Budget</p>
          <p className="text-sm font-semibold text-gray-800">
            {formatCurrency(client.budget)}
          </p>
        </div>

        {/* Location */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium mb-1">Location</p>
          <p className="text-sm font-semibold text-gray-800 truncate">
            {client.preferredLocation || 'N/A'}
          </p>
        </div>

        {/* Visit Date */}
        {client.visitingDate && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-medium mb-1">Visit Date</p>
            <p className="text-sm font-semibold text-blue-800">
              {formatDate(client.visitingDate)}
            </p>
          </div>
        )}

        {/* Follow Up Date */}
        {client.followUpDate && (
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-orange-600 font-medium mb-1">Follow Up</p>
            <p className="text-sm font-semibold text-orange-800">
              {formatDate(client.followUpDate)}
            </p>
          </div>
        )}
      </div>

      {/* Source & Notes */}
      {client.source && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 font-medium mb-1">Source</p>
          <span className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">
            {client.source}
          </span>
        </div>
      )}

      {client.notes && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 font-medium mb-1">Notes</p>
          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded line-clamp-2">
            {client.notes}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <Button
          onClick={() => handleStatusChange('Interested')}
          disabled={client.status === 'Interested'}
          className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          👁️ Interested
        </Button>
        <Button
          onClick={() => handleStatusChange('DealDone')}
          disabled={client.status === 'DealDone'}
          className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          ✅ Deal Done
        </Button>
      </div>
    </div>
  );
}