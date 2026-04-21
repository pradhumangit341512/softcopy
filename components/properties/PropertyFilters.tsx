'use client';

import { Search, X, Calendar, IndianRupee } from 'lucide-react';
import { Select } from '@/components/common/Select';
import { Input } from '@/components/common/Input';
import {
  BHK_TYPE_OPTIONS,
  PROPERTY_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from '@/lib/types';

export interface PropertyFilterValues {
  status: string;
  propertyType: string;
  bhkType: string;
  listingType: string;
  priceMin: string;
  priceMax: string;
  vacateFrom: string;
  vacateTo: string;
  createdBy: string;
  search: string;
}

interface PropertyFiltersProps {
  filters: PropertyFilterValues;
  onFilterChange: (filters: PropertyFilterValues) => void;
  teamMembers?: { id: string; name: string }[];
  isAdmin?: boolean;
}

const EMPTY_FILTERS: PropertyFilterValues = {
  status: '',
  propertyType: '',
  bhkType: '',
  listingType: '',
  priceMin: '',
  priceMax: '',
  vacateFrom: '',
  vacateTo: '',
  createdBy: '',
  search: '',
};

export function PropertyFilters({
  filters,
  onFilterChange,
  teamMembers = [],
  isAdmin = false,
}: PropertyFiltersProps) {
  const statusOptions = [
    { value: '', label: 'All Status' },
    ...PROPERTY_STATUS_OPTIONS,
  ];

  const propertyTypeOptions = [
    { value: '', label: 'All Types' },
    ...PROPERTY_TYPE_OPTIONS,
  ];

  const bhkOptions = [
    { value: '', label: 'All BHK' },
    ...BHK_TYPE_OPTIONS,
  ];

  const memberOptions = [
    { value: '', label: 'All Members' },
    ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
  ];

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => v && k !== 'search'
  ).length;

  return (
    <div className="space-y-3">
      {/* ── Row 1: Search ── */}
      <Input
        className="text-black"
        placeholder="Search name, owner, phone, address..."
        icon={<Search size={16} />}
        value={filters.search}
        onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
      />

      {/* ── Row 2: Dropdowns ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Select
          className="text-black"
          options={statusOptions}
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
        />
        <Select
          className="text-black"
          options={propertyTypeOptions}
          value={filters.propertyType}
          onChange={(e) => onFilterChange({ ...filters, propertyType: e.target.value, bhkType: '' })}
        />
        <Select
          className="text-black"
          options={bhkOptions}
          value={filters.bhkType}
          onChange={(e) => onFilterChange({ ...filters, bhkType: e.target.value })}
        />
        {isAdmin && teamMembers.length > 0 ? (
          <Select
            className="text-black"
            options={memberOptions}
            value={filters.createdBy}
            onChange={(e) => onFilterChange({ ...filters, createdBy: e.target.value })}
          />
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      {/* ── Row 3: Listing toggle + Price + Vacate ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Listing Type Toggle */}
        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Listing
          </p>
          <div className="flex gap-0.5 p-1 bg-gray-100 rounded-lg h-[38px]">
            {([
              { value: '', label: 'All' },
              { value: 'rent', label: 'Rent' },
              { value: 'sale', label: 'Sale' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  onFilterChange({ ...filters, listingType: opt.value, priceMin: '', priceMax: '' })
                }
                className={`flex-1 text-xs font-semibold rounded-md transition-all
                  ${filters.listingType === opt.value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            <IndianRupee size={10} className="inline -mt-0.5" />
            {' '}Price {filters.listingType === 'sale' ? '(Sale)' : filters.listingType === 'rent' ? '(Rent)' : '(Rent)'}
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min"
              value={filters.priceMin}
              onChange={(e) => onFilterChange({ ...filters, priceMin: e.target.value })}
              className="w-full h-[38px] px-3 text-sm border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-gray-300 text-xs shrink-0">–</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.priceMax}
              onChange={(e) => onFilterChange({ ...filters, priceMax: e.target.value })}
              className="w-full h-[38px] px-3 text-sm border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Vacate Date Range */}
        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            <Calendar size={10} className="inline -mt-0.5" /> Vacate Date
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.vacateFrom}
              onChange={(e) => onFilterChange({ ...filters, vacateFrom: e.target.value })}
              className="w-full h-[38px] px-2.5 text-sm border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
            />
            <span className="text-gray-300 text-xs shrink-0">–</span>
            <input
              type="date"
              value={filters.vacateTo}
              onChange={(e) => onFilterChange({ ...filters, vacateTo: e.target.value })}
              className="w-full h-[38px] px-2.5 text-sm border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
            />
          </div>
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {filters.status && (
            <Chip label={filters.status} onRemove={() => onFilterChange({ ...filters, status: '' })} />
          )}
          {filters.propertyType && (
            <Chip label={filters.propertyType} onRemove={() => onFilterChange({ ...filters, propertyType: '', bhkType: '' })} />
          )}
          {filters.bhkType && (
            <Chip label={filters.bhkType} onRemove={() => onFilterChange({ ...filters, bhkType: '' })} />
          )}
          {filters.listingType && (
            <Chip
              label={filters.listingType === 'rent' ? 'For Rent' : 'For Sale'}
              onRemove={() => onFilterChange({ ...filters, listingType: '', priceMin: '', priceMax: '' })}
            />
          )}
          {(filters.priceMin || filters.priceMax) && (
            <Chip
              label={`₹${filters.priceMin || '0'} – ₹${filters.priceMax || '∞'}`}
              onRemove={() => onFilterChange({ ...filters, priceMin: '', priceMax: '' })}
            />
          )}
          {(filters.vacateFrom || filters.vacateTo) && (
            <Chip
              label={`Vacate: ${filters.vacateFrom || '…'} → ${filters.vacateTo || '…'}`}
              onRemove={() => onFilterChange({ ...filters, vacateFrom: '', vacateTo: '' })}
            />
          )}
          {filters.createdBy && (
            <Chip
              label={`By: ${teamMembers.find((m) => m.id === filters.createdBy)?.name || '…'}`}
              onRemove={() => onFilterChange({ ...filters, createdBy: '' })}
            />
          )}
          <button
            onClick={() => onFilterChange(EMPTY_FILTERS)}
            className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors
              px-2 py-0.5"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium
      text-blue-700 bg-blue-50 border border-blue-100 rounded-full leading-relaxed">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 transition-colors">
        <X size={11} />
      </button>
    </span>
  );
}
