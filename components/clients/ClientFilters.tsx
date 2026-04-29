'use client';

import { useState } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { LEAD_STATUSES, LEAD_SOURCES, LEAD_STATUS_TONE } from '@/lib/constants';
import { useFeature } from '@/hooks/useFeature';

// ── Types ──
export interface ClientFilterValues {
  status: string;
  source: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  followUp: string;
  budgetMin: string;
  budgetMax: string;
}

interface ClientFiltersProps {
  filters: ClientFilterValues;
  onFilterChange: (filters: ClientFilterValues) => void;
  counts?: Record<string, number>;
}

// ── Constants ──
// Legacy chip lists shown when the company doesn't have the F6 / F8 feature
// flags. These match what the page used to ship before plan-based gating
// landed — touching them would change behaviour for un-upgraded customers.
const LEGACY_STATUSES = ['New', 'Interested', 'Contacted', 'Visited', 'DealDone', 'Rejected'];
const LEGACY_SOURCES = ['WhatsApp', 'Walk-in', 'Referral', 'Website', 'Direct', 'Social Media'];
const FOLLOWUP_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'none', label: 'No Follow-up' },
];

// Tone → Tailwind chip colour. Keeps active/selected styling consistent
// with the LEAD_STATUS_TONE map (the source of truth in lib/constants.ts).
const TONE_TO_CHIP: Record<string, string> = {
  red:     'bg-red-100 text-red-700 border-red-200',
  amber:   'bg-amber-100 text-amber-700 border-amber-200',
  blue:    'bg-blue-100 text-blue-700 border-blue-200',
  emerald: 'bg-green-100 text-green-700 border-green-200',
  gray:    'bg-gray-100 text-gray-700 border-gray-200',
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
};

// Legacy chip palette — kept verbatim so customers without F6 see the
// exact same colours they're used to.
const LEGACY_STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700 border-blue-200',
  Interested: 'bg-amber-100 text-amber-700 border-amber-200',
  Contacted: 'bg-purple-100 text-purple-700 border-purple-200',
  Visited: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  DealDone: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};

export function ClientFilters({ filters, onFilterChange, counts = {} }: ClientFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Feature-aware chip lists. When extended_lead_statuses is on the chip
  // strip uses the canonical 8-status taxonomy; otherwise the legacy 6.
  // Same shape for sources via F8.
  const useExtendedStatuses = useFeature('feature.extended_lead_statuses');
  const useSourcePresets = useFeature('feature.source_presets');
  const STATUSES: ReadonlyArray<string> = useExtendedStatuses
    ? LEAD_STATUSES
    : LEGACY_STATUSES;
  const SOURCES: ReadonlyArray<string> = useSourcePresets
    ? LEAD_SOURCES
    : LEGACY_SOURCES;

  // Parse multi-select values (comma-separated in URL)
  const selectedStatuses = filters.status ? filters.status.split(',') : [];
  const selectedSources = filters.source ? filters.source.split(',') : [];

  const activeCount = [
    filters.status, filters.source, filters.search,
    filters.dateFrom, filters.dateTo, filters.followUp,
    filters.budgetMin, filters.budgetMax,
  ].filter(Boolean).length;

  // ── Helpers ──
  function toggleStatus(s: string) {
    const next = selectedStatuses.includes(s)
      ? selectedStatuses.filter((v) => v !== s)
      : [...selectedStatuses, s];
    onFilterChange({ ...filters, status: next.join(',') });
  }

  function toggleSource(s: string) {
    const next = selectedSources.includes(s)
      ? selectedSources.filter((v) => v !== s)
      : [...selectedSources, s];
    onFilterChange({ ...filters, source: next.join(',') });
  }

  function clearAll() {
    onFilterChange({
      status: '', source: '', search: '',
      dateFrom: '', dateTo: '', followUp: '',
      budgetMin: '', budgetMax: '',
    });
  }

  function removeFilter(key: keyof ClientFilterValues) {
    onFilterChange({ ...filters, [key]: '' });
  }

  // ── Active filter tags ──
  const activeTags: { label: string; key: keyof ClientFilterValues }[] = [];
  if (filters.status) {
    selectedStatuses.forEach((s) => activeTags.push({ label: s, key: 'status' }));
  }
  if (filters.source) {
    selectedSources.forEach((s) => activeTags.push({ label: s, key: 'source' }));
  }
  if (filters.followUp) {
    const fl = FOLLOWUP_OPTIONS.find((o) => o.value === filters.followUp);
    if (fl) activeTags.push({ label: fl.label, key: 'followUp' });
  }
  if (filters.budgetMin || filters.budgetMax) {
    const label = `₹${filters.budgetMin || '0'} - ₹${filters.budgetMax || '∞'}`;
    activeTags.push({ label, key: 'budgetMin' });
  }
  if (filters.dateFrom || filters.dateTo) {
    activeTags.push({ label: `${filters.dateFrom || '...'} → ${filters.dateTo || '...'}`, key: 'dateFrom' });
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, phone, email..."
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl
            bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
            text-gray-800 placeholder:text-gray-400 transition-all"
        />
        {filters.search && (
          <button onClick={() => removeFilter('search')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Row 2: Quick status chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onFilterChange({ ...filters, status: '' })}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all
            ${!filters.status
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
        >
          All
        </button>
        {STATUSES.map((s) => {
          const isActive = selectedStatuses.includes(s);
          const count = counts[s] ?? 0;
          // Resolve the active-chip colour from whichever palette is in
          // effect — extended palette goes through tone → chip lookup,
          // legacy palette is a direct map. Inactive chips share styling.
          const activeChipColor = useExtendedStatuses
            ? TONE_TO_CHIP[LEAD_STATUS_TONE[s as keyof typeof LEAD_STATUS_TONE] ?? 'gray'] ?? 'bg-gray-100 text-gray-700 border-gray-200'
            : LEGACY_STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700 border-gray-200';
          const colorClass = isActive ? activeChipColor : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400';
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${colorClass}`}
            >
              {s === 'DealDone' ? 'Deal Done' : s}
              {count > 0 && (
                <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold
                  flex items-center justify-center ${isActive ? 'bg-white/30' : 'bg-gray-100'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Row 3: Follow-up quick filters */}
      <div className="flex flex-wrap gap-1.5">
        {FOLLOWUP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onFilterChange({ ...filters, followUp: filters.followUp === opt.value ? '' : opt.value })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all
              ${filters.followUp === opt.value
                ? opt.value === 'overdue'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : opt.value === 'today'
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Active filter tags */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Active:</span>
          {activeTags.map((tag, i) => (
            <span key={`${tag.key}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium
                bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
              {tag.label}
              <button onClick={() => {
                if (tag.key === 'status') {
                  const next = selectedStatuses.filter((s) => s !== tag.label);
                  onFilterChange({ ...filters, status: next.join(',') });
                } else if (tag.key === 'source') {
                  const next = selectedSources.filter((s) => s !== tag.label);
                  onFilterChange({ ...filters, source: next.join(',') });
                } else if (tag.key === 'budgetMin') {
                  onFilterChange({ ...filters, budgetMin: '', budgetMax: '' });
                } else if (tag.key === 'dateFrom') {
                  onFilterChange({ ...filters, dateFrom: '', dateTo: '' });
                } else {
                  removeFilter(tag.key);
                }
              }} className="text-blue-400 hover:text-blue-700">
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-medium ml-1">
            Clear all
          </button>
        </div>
      )}

      {/* Advanced filters toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <SlidersHorizontal size={13} />
        Advanced Filters
        <ChevronDown size={13} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        {activeCount > 0 && (
          <span className="ml-1 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold
            flex items-center justify-center">{activeCount}</span>
        )}
      </button>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          {/* Source multi-select */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Source</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {SOURCES.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(s)}
                    onChange={() => toggleSource(s)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{s}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Budget range */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Budget Range</label>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Min (₹)"
                value={filters.budgetMin}
                onChange={(e) => onFilterChange({ ...filters, budgetMin: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <input
                type="number"
                placeholder="Max (₹)"
                value={filters.budgetMax}
                onChange={(e) => onFilterChange({ ...filters, budgetMax: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Date Range</label>
            <div className="space-y-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Follow-up filter */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Follow-up Status</label>
            <div className="space-y-1.5">
              {FOLLOWUP_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="followUp"
                    checked={filters.followUp === opt.value}
                    onChange={() => onFilterChange({ ...filters, followUp: opt.value })}
                    className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
