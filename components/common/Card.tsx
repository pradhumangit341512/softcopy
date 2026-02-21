import { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  rounded?: 'sm' | 'md' | 'lg';
}

export default function Card({
  children,
  className,
  hoverable = false,
  shadow = 'sm',
  border = true,
  rounded = 'md',
}: CardProps) {
  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  };

  const roundedClasses = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
  };

  return (
    <div
      className={clsx(
        'bg-white',
        border && 'border border-gray-200',
        shadowClasses[shadow],
        roundedClasses[rounded],
        hoverable && 'hover:shadow-lg transition-shadow duration-200 cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  children,
}: CardHeaderProps) {
  return (
    <div className="border-b border-gray-200 p-6 flex items-start justify-between">
      <div>
        {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={clsx('p-6', className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={clsx('border-t border-gray-200 p-6', className)}>
      {children}
    </div>
  );
}