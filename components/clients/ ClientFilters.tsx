'use client';

import { Search } from 'lucide-react';
import Select from '@/components/common/Select';
import Input from '../common/ Input';
import Button from '../common/ Button';

interface ClientFiltersProps {
  filters: {
    status: string;
    search: string;
    dateFrom: string;
    dateTo: string;
  };
  onFilterChange: (filters: any) => void;
}

export default function ClientFilters({
  filters,
  onFilterChange,
}: ClientFiltersProps) {
  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'New', label: 'New' },
    { value: 'Interested', label: 'Interested' },
    { value: 'DealDone', label: 'Deal Done' },
    { value: 'Rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
        className='text-black'
          placeholder="Search by name, phone, email..."
          icon={<Search size={18} />}
          value={filters.search}
          onChange={(e) =>
            onFilterChange({ ...filters, search: e.target.value })
          }
        />

        <Select
        className='text-black'
          options={statusOptions}
          value={filters.status}
          onChange={(e) =>
            onFilterChange({ ...filters, status: e.target.value })
          }
        />

        <Button
          variant="outline"
          onClick={() =>
            onFilterChange({
              status: '',
              search: '',
              dateFrom: '',
              dateTo: '',
            })
          }
        >
          Clear Filters
        </Button>
      </div>

      {/* Date Range Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
        className='text-black'
          type="date"
          label="From Date"
          value={filters.dateFrom}
          onChange={(e) =>
            onFilterChange({ ...filters, dateFrom: e.target.value })
          }
        />

        <Input
        className='text-black'

          type="date"
          label="To Date"
          value={filters.dateTo}
          onChange={(e) =>
            onFilterChange({ ...filters, dateTo: e.target.value })
          }
        />
      </div>
    </div>
  );
}