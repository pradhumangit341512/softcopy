'use client';

import { Search } from 'lucide-react';
import { Select } from '@/components/common/Select';
import { Input } from '../common/Input';
import { Button } from '../common/Button';

interface PropertyFilterValues {
  status: string;
  propertyType: string;
  search: string;
}

interface PropertyFiltersProps {
  filters: PropertyFilterValues;
  onFilterChange: (filters: PropertyFilterValues) => void;
}

/** Filter controls for the properties list — search, status, and property type */
export function PropertyFilters({
  filters,
  onFilterChange,
}: PropertyFiltersProps) {
  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'Available', label: 'Available' },
    { value: 'Rented', label: 'Rented' },
    { value: 'Sold', label: 'Sold' },
    { value: 'Unavailable', label: 'Unavailable' },
  ];

  const propertyTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'Flat', label: 'Flat' },
    { value: 'House', label: 'House' },
    { value: 'Villa', label: 'Villa' },
    { value: 'Plot', label: 'Plot' },
    { value: 'Land', label: 'Land' },
    { value: 'Commercial', label: 'Commercial' },
    { value: 'Shop', label: 'Shop' },
    { value: 'Office', label: 'Office' },
    { value: 'Warehouse', label: 'Warehouse' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Input
        className="text-black"
        placeholder="Search by name, owner, phone, address..."
        icon={<Search size={18} />}
        value={filters.search}
        onChange={(e) =>
          onFilterChange({ ...filters, search: e.target.value })
        }
      />

      <Select
        className="text-black"
        options={statusOptions}
        value={filters.status}
        onChange={(e) =>
          onFilterChange({ ...filters, status: e.target.value })
        }
      />

      <Select
        className="text-black"
        options={propertyTypeOptions}
        value={filters.propertyType}
        onChange={(e) =>
          onFilterChange({ ...filters, propertyType: e.target.value })
        }
      />

      <Button
        variant="outline"
        onClick={() =>
          onFilterChange({
            status: '',
            propertyType: '',
            search: '',
          })
        }
      >
        Clear Filters
      </Button>
    </div>
  );
}
