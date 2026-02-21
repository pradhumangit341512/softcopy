import clsx from 'clsx';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'blue' | 'white' | 'gray' | 'green' | 'red';
}

export default function Spinner({ size = 'md', color = 'blue' }: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-4 h-4 border-2',
    sm: 'w-6 h-6 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const colorClasses = {
    blue: 'border-blue-200 border-t-blue-600',
    white: 'border-white border-opacity-30 border-t-white',
    gray: 'border-gray-200 border-t-gray-600',
    green: 'border-green-200 border-t-green-600',
    red: 'border-red-200 border-t-red-600',
  };

  return (
    <div
      className={clsx(
        'rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color]
      )}
    />
  );
}