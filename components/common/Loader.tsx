import React from 'react';
import clsx from 'clsx';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
}

export default function Loader({
  size = 'md',
  fullScreen = false,
  message,
}: LoaderProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const loaderContent = (
    <div className="flex flex-col items-center gap-4">
      {/* Spinner */}
      <div className={clsx('relative', sizeClasses[size])}>
        <div
          className={clsx(
            'absolute inset-0 rounded-full border-4 border-gray-200',
            sizeClasses[size]
          )}
        />
        <div
          className={clsx(
            'absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin',
            sizeClasses[size]
          )}
        />
      </div>

      {/* Message */}
      {message && (
        <p className="text-gray-600 font-medium text-center text-sm">
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        {loaderContent}
      </div>
    );
  }

  return <div className="flex justify-center items-center">{loaderContent}</div>;
}