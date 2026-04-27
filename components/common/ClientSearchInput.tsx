'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, X, Loader2, User } from 'lucide-react';

/**
 * Lightweight client used for search/select. Matches the subset returned by
 * /api/clients (the full Client type from lib/types is much wider — we only
 * need three fields to render a chip / dropdown row).
 */
export interface SelectedClient {
  id: string;
  clientName: string;
  phone: string;
}

interface ClientSearchInputProps {
  /** Currently selected client. `null` puts the component into search mode. */
  selected: SelectedClient | null;
  /** Called with the new selection (or `null` when cleared). */
  onSelect: (client: SelectedClient | null) => void;
  /** Disable the input (e.g. while submitting the parent form). */
  disabled?: boolean;
  /** Focus on mount — useful when this is the first field of a modal. */
  autoFocus?: boolean;
  /**
   * If true, the chip cannot be removed once a client is picked. Used in
   * Manage mode where switching the client of an existing commission is
   * not a valid operation (it would orphan deal payments / splits).
   */
  lockOnceSelected?: boolean;
  /** Optional id for label association. */
  inputId?: string;
}

/**
 * Debounced typeahead for clients. Hits /api/clients?search=&limit=20 — the
 * existing route already searches by name, phone, and email case-insensitively.
 *
 * Two display modes:
 *   - "search": empty input + dropdown of results as the user types
 *   - "selected": a chip showing the picked client; click ✕ to go back to search
 */
export function ClientSearchInput({
  selected,
  onSelect,
  disabled,
  autoFocus,
  lockOnceSelected,
  inputId,
}: ClientSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SelectedClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Sequence id so a slow earlier fetch can't stomp a fresh one.
  const fetchSeq = useRef(0);

  /**
   * Debounced fetch. Runs 250ms after the user stops typing. Empty query
   * clears the dropdown without hitting the network.
   */
  useEffect(() => {
    if (selected) return; // search mode is disabled while a chip is shown
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const seq = ++fetchSeq.current;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/clients?search=${encodeURIComponent(trimmed)}&limit=20`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { clients?: Array<{ id: string; clientName: string; phone: string }> } = await res.json();
        if (seq !== fetchSeq.current) return; // a newer fetch has started
        setResults(
          (data.clients ?? []).map((c) => ({
            id: c.id,
            clientName: c.clientName,
            phone: c.phone,
          })),
        );
        setActiveIndex(0);
      } catch {
        if (seq === fetchSeq.current) setResults([]);
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query, selected]);

  /** Close the dropdown when the user clicks elsewhere. */
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const pick = useCallback(
    (c: SelectedClient) => {
      onSelect(c);
      setQuery('');
      setResults([]);
      setOpen(false);
    },
    [onSelect],
  );

  const clear = useCallback(() => {
    if (lockOnceSelected) return;
    onSelect(null);
    setQuery('');
    setResults([]);
    // Refocus so the user can immediately type a new search.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onSelect, lockOnceSelected]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = results[activeIndex];
      if (picked) pick(picked);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ── Selected (chip) mode ────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 border border-blue-200 bg-blue-50/40
        rounded-xl">
        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center
          flex-shrink-0">
          <User size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{selected.clientName}</p>
          <p className="text-xs text-gray-500 truncate">{selected.phone}</p>
        </div>
        {!lockOnceSelected && (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            aria-label={`Clear selected client ${selected.clientName}`}
            className="w-7 h-7 rounded-lg hover:bg-blue-100 text-blue-600 flex items-center
              justify-center flex-shrink-0 transition-colors disabled:opacity-50"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  // ── Search mode ──────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={14} />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
          aria-controls="client-search-listbox"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={query}
          placeholder="Search by name, phone, or email…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
            text-gray-800 placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Loader2 size={14} className="animate-spin" />
          </span>
        )}
      </div>

      {open && (results.length > 0 || (query.trim().length > 0 && !loading)) && (
        <ul
          id="client-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white
            border border-gray-200 rounded-xl shadow-lg z-30"
        >
          {results.length === 0 && !loading && (
            <li className="px-3 py-4 text-center text-xs text-gray-400">
              No matching clients. Add the client first from{' '}
              <span className="font-medium">Clients → New</span>.
            </li>
          )}

          {results.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                // mousedown (not click) so we beat the input's blur handler
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-3 py-2.5 cursor-pointer flex items-center gap-2 border-b border-gray-50
                last:border-b-0 transition-colors ${
                  i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  i === activeIndex ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <User size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.clientName}</p>
                <p className="text-xs text-gray-500 truncate">{c.phone}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
