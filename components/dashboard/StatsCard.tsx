import clsx from 'clsx';
import { ReactNode } from 'react';

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
        'p-6 rounded-lg border-2 transition-all duration-200',
        highlight
          ? 'border-red-400 bg-red-50'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>

          <p
            className={clsx(
              'text-2xl font-bold mt-2',
              highlight && 'text-red-600'
            )}
          >
            {value}
          </p>

          {change && (
            <p
              className={clsx(
                'text-sm mt-2 font-semibold',
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend === 'up' ? '↑' : '↓'} {change}
            </p>
          )}
        </div>

        {icon && <span className="text-3xl">{icon}</span>}
      </div>
    </div>
  );
}