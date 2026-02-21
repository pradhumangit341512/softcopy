import clsx from 'clsx';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export default function Badge({
  label,
  variant = 'primary',
  size = 'sm',
  icon,
}: BadgeProps) {
  const styles = {
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        styles[variant],
        sizes[size]
      )}
    >
      {icon}
      {label}
    </span>
  );
}