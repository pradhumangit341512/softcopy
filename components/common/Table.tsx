import { ReactNode } from 'react';
import clsx from 'clsx';

interface TableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => ReactNode;
  width?: string;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  striped?: boolean;
  hover?: boolean;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  loading = false,
  empty = 'No data found',
  striped = true,
  hover = true,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">Loading...</div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">{empty}</div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full">
        {/* Header */}
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={clsx(
                  'px-6 py-3 text-left text-sm font-semibold text-gray-700',
                  column.width
                )}
              >
                <div className="flex items-center gap-2">
                  {column.label}
                  {column.sortable && (
                    <span className="text-gray-400 cursor-pointer">⇅</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {data.map((row, index) => (
            <tr
              key={keyExtractor(row)}
              className={clsx(
                'border-b border-gray-200 transition',
                striped && index % 2 === 0 && 'bg-gray-50',
                hover && 'hover:bg-blue-50',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className="px-6 py-4 text-sm text-gray-700"
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : String(row[column.key] || '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}