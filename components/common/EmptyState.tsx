import { ReactNode } from 'react';
import Button from './ Button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  image?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  image,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {image ? (
        <img src={image} alt={title} className="w-48 h-48 mb-6" />
      ) : (
        <div className="text-6xl mb-6">{icon}</div>
      )}

      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center max-w-md mb-6">{description}</p>

      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}