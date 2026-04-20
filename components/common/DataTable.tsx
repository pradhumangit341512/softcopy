'use client';

import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Loader } from './Loader';

/**
 * Generic data table — used by Clients, Properties, Commissions, Users.
 * Caller defines the columns; row identity comes from `getRowKey`.
 *
 * Doesn't implement sort/pagination itself — those are URL-driven on the
 * parent page (so refresh + back-button work). Pass paginated `rows` in.
 */

export interface Column<T> {
  /** Header label */
  header: string;
  /** Cell renderer — full row + index. Return any JSX. */
  cell: (row: T, index: number) => ReactNode;
  /** Tailwind classes for `<td>`/`<th>` width + alignment */
  className?: string;
  /** Extra `<th>` classes for the header cell only */
  headerClassName?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  /** Stable React key per row — usually the DB id. */
  getRowKey: (row: T) => string;
  /** Click handler for the entire row (e.g. drill into details). */
  onRowClick?: (row: T) => void;
  loading?: boolean;
  /** Empty-state copy when `rows` is `[]` and not loading. */
  emptyTitle?: string;
  emptyMessage?: string;
  /** Render a custom action in the empty state (e.g. "Add your first client"). */
  emptyAction?: ReactNode;
  /** Optional className appended to <table> */
  tableClassName?: string;
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  onRowClick,
  loading = false,
  emptyTitle = 'No records yet',
  emptyMessage = 'Add your first one to get started.',
  emptyAction,
  tableClassName = '',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="py-12">
        <Loader size="md" message="Loading..." />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border border-dashed border-gray-200">
        <Inbox size={40} className="text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-900 mb-1">{emptyTitle}</h3>
        <p className="text-sm text-gray-500 mb-4 text-center max-w-sm">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
      <table className={`min-w-full text-sm ${tableClassName}`}>
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, rIdx) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={
                onRowClick
                  ? 'cursor-pointer hover:bg-gray-50 transition-colors'
                  : ''
              }
            >
              {columns.map((col, cIdx) => (
                <td
                  key={cIdx}
                  className={`px-4 py-3 text-gray-700 ${col.className ?? ''}`}
                >
                  {col.cell(row, rIdx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
