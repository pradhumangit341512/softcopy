import type { ReactNode } from 'react';

/**
 * Compact summary stat card — matches the dashboard's stat tiles (uppercase
 * label + large value + optional hint). Used across the HR/Payroll pages.
 */
export function StatCard({
  label,
  value,
  hint,
  className = '',
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-lg sm:text-xl font-bold font-display text-gray-900 mt-0.5 truncate">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

/**
 * Muted empty-state block for tables/lists — a soft icon chip above a short
 * message (optionally with a hint line). Keeps the app's understated empty
 * style but reads as "finished" rather than a bare line of grey text.
 */
export function EmptyBlock({
  icon,
  text,
  hint,
}: {
  icon: ReactNode;
  text: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300 mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-600">{text}</p>
      {hint && <p className="text-xs text-gray-400 mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}
