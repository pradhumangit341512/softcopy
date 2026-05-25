'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Search, Building2, MapPin, IndianRupee, Trash2, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/lib/utils';
import type { PropertyAssignment } from '@/lib/types';

const STATUS_OPTIONS = ['Suggested', 'Interested', 'Visited', 'Rejected'] as const;
const STATUS_VARIANTS: Record<string, 'primary' | 'warning' | 'success' | 'danger'> = {
  Suggested: 'primary',
  Interested: 'warning',
  Visited: 'success',
  Rejected: 'danger',
};

interface PropertySearchResult {
  id: string;
  propertyName: string;
  address: string;
  propertyType: string;
  bhkType?: string;
  askingRent?: number;
  sellingPrice?: number;
  area?: string;
  status: string;
  projectName?: string;
  sectorNo?: string;
}

interface AssignedPropertiesProps {
  clientId: string;
  clientName: string;
  isAdmin: boolean;
}

export function AssignedProperties({ clientId, clientName, isAdmin }: AssignedPropertiesProps) {
  const [assignments, setAssignments] = useState<PropertyAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Search popup state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PropertySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [assignNote, setAssignNote] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/properties`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // Close search popup on outside click / Escape
  useEffect(() => {
    if (!showSearch) return;
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSearch();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showSearch]);

  function closeSearch() {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPropertyId(null);
    setAssignNote('');
  }

  // Debounced property search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/properties?search=${encodeURIComponent(searchQuery)}&status=Available&limit=10`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const props = data.properties || data;
          // Filter out already-assigned properties
          const assignedIds = new Set(assignments.map((a) => a.propertyId));
          setSearchResults(
            (Array.isArray(props) ? props : []).filter(
              (p: PropertySearchResult) => !assignedIds.has(p.id)
            )
          );
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, assignments]);

  async function handleAssign() {
    if (!selectedPropertyId) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/properties`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedPropertyId, notes: assignNote || undefined }),
      });
      if (res.ok) {
        closeSearch();
        fetchAssignments();
      }
    } catch {
      // silent
    } finally {
      setAssigning(false);
    }
  }

  async function handleStatusChange(propertyId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/clients/${clientId}/properties/${propertyId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchAssignments();
    } catch {
      // silent
    }
  }

  async function handleRemove(propertyId: string) {
    try {
      const res = await fetch(`/api/clients/${clientId}/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) fetchAssignments();
    } catch {
      // silent
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
            <Building2 size={14} className="text-purple-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">
            Assigned Properties
            {assignments.length > 0 && (
              <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {assignments.length}
              </span>
            )}
          </h3>
        </div>

        {isAdmin && (
          <div className="relative">
            <Button
              size="sm"
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-purple-600
                hover:bg-purple-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Assign Property
            </Button>

            {/* Search & Assign Popup */}
            {showSearch && (
              <div
                ref={searchRef}
                className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl
                  border border-gray-200 shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-900">Assign Property to {clientName}</h4>
                    <button onClick={closeSearch} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search properties by name, address, sector..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                        focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </div>
                </div>

                {/* Search results */}
                <div className="max-h-60 overflow-y-auto">
                  {searching && (
                    <p className="text-xs text-gray-400 text-center py-4">Searching...</p>
                  )}
                  {!searching && searchQuery && searchResults.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No available properties found</p>
                  )}
                  {searchResults.map((prop) => (
                    <button
                      key={prop.id}
                      onClick={() => setSelectedPropertyId(selectedPropertyId === prop.id ? null : prop.id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50
                        transition-colors ${selectedPropertyId === prop.id ? 'bg-purple-50 border-l-2 border-l-purple-500' : ''}`}
                    >
                      <p className="text-sm font-medium text-gray-900">{prop.propertyName}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <MapPin size={10} /> {prop.address}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-gray-600">{prop.propertyType}</span>
                        {prop.bhkType && <span className="text-gray-400">{prop.bhkType}</span>}
                        {(prop.sellingPrice || prop.askingRent) && (
                          <span className="text-green-700 font-medium">
                            {formatCurrency(prop.sellingPrice || prop.askingRent || 0)}
                          </span>
                        )}
                        {prop.area && <span className="text-gray-400">{prop.area}</span>}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Note + Assign button */}
                {selectedPropertyId && (
                  <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <input
                      type="text"
                      placeholder="Add a note (optional) — e.g. 'budget mein hai'"
                      value={assignNote}
                      onChange={(e) => setAssignNote(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-3
                        focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                    <button
                      onClick={handleAssign}
                      disabled={assigning}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm
                        font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg
                        transition-colors disabled:opacity-60"
                    >
                      <Plus size={14} />
                      {assigning ? 'Assigning...' : 'Assign Property'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assignment list */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading...</p>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8">
            <Building2 size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No properties assigned yet</p>
            {isAdmin && (
              <p className="text-xs text-gray-400 mt-1">Click &quot;Assign Property&quot; to suggest a property for this lead</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                isAdmin={isAdmin}
                onStatusChange={handleStatusChange}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment,
  isAdmin,
  onStatusChange,
  onRemove,
}: {
  assignment: PropertyAssignment;
  isAdmin: boolean;
  onStatusChange: (propertyId: string, status: string) => void;
  onRemove: (propertyId: string) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prop = assignment.property;

  useEffect(() => {
    if (!showDropdown) return;
    function close(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showDropdown]);

  if (!prop) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors bg-gray-50/50">
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 mt-0.5">
        <Building2 size={18} className="text-purple-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">{prop.propertyName}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {prop.address}
            </p>
          </div>

          {/* Status badge + dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => isAdmin && setShowDropdown(!showDropdown)}
              className={`flex items-center gap-1 ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <Badge
                label={assignment.status}
                variant={STATUS_VARIANTS[assignment.status] || 'primary'}
                size="sm"
              />
              {isAdmin && <ChevronDown size={12} className="text-gray-400" />}
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg border border-gray-200 shadow-lg z-40 py-1">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onStatusChange(assignment.propertyId, s);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors
                      ${assignment.status === s ? 'font-semibold text-purple-700 bg-purple-50' : 'text-gray-700'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Property details row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
          <span>{prop.propertyType}{prop.bhkType ? ` / ${prop.bhkType}` : ''}</span>
          {(prop.sellingPrice || prop.askingRent) && (
            <span className="flex items-center gap-0.5 font-medium text-green-700">
              <IndianRupee size={10} />
              {formatCurrency(prop.sellingPrice || prop.askingRent || 0).replace('₹', '')}
            </span>
          )}
          {prop.area && <span>{prop.area}</span>}
        </div>

        {/* Note + assigner */}
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-400">
            {assignment.notes && (
              <span className="text-gray-500 italic mr-2">&quot;{assignment.notes}&quot;</span>
            )}
            {assignment.assigner && <span>by {assignment.assigner.name}</span>}
          </div>

          {isAdmin && (
            <button
              onClick={() => onRemove(assignment.propertyId)}
              title="Remove assignment"
              className="text-gray-300 hover:text-red-500 transition-colors p-1"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
