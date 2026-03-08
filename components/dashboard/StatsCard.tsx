import clsx from 'clsx';
import { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: string | ReactNode;
  highlight?: boolean;
  change?: string;
  trend?: 'up' | 'down';
}

export default function StatsCard({
  title,
  value,
  icon,
  highlight = false,
  change,
  trend,
}: StatsCardProps) {
  return (
    <div
      className={clsx(
        'relative rounded-2xl p-4 sm:p-5 border transition-all duration-200 overflow-hidden',
        highlight
          ? 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50 shadow-sm shadow-red-100'
          : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-md hover:shadow-blue-50'
      )}
    >
      {/* Subtle bg circle */}
      {icon && (
        <span className={clsx(
          'absolute -top-3 -right-3 text-5xl opacity-10 select-none pointer-events-none',
        )}>
          {typeof icon === 'string' ? icon : null}
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={clsx(
            'text-xs sm:text-sm font-medium truncate',
            highlight ? 'text-red-600' : 'text-gray-500'
          )}>
            {title}
          </p>

          <p className={clsx(
            'text-xl sm:text-2xl font-bold mt-1.5 tracking-tight',
            highlight ? 'text-red-700' : 'text-gray-900'
          )}>
            {value}
          </p>

          {change && (
            <div className={clsx(
              'inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2 py-0.5 rounded-full',
              trend === 'up'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-red-600 bg-red-50'
            )}>
              {trend === 'up'
                ? <ArrowUpRight size={11} />
                : <ArrowDownRight size={11} />
              }
              {change}
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl',
            highlight ? 'bg-red-100' : 'bg-gray-50'
          )}>
            {icon}
          </div>
        )}
      </div>

      {/* Highlight pulse dot */}
      {highlight && (
        <span className="absolute top-3 right-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full
              rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        </span>
      )}
    </div>
  );
}