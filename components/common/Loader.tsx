'use client';

import React from 'react';
import clsx from 'clsx';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
}

/** Premium animated loading indicator with optional full-screen overlay */
export function Loader({
  size = 'md',
  fullScreen = false,
  message = 'Loading...',
}: LoaderProps) {
  const sizeMap = {
    sm: 40,
    md: 56,
    lg: 72,
  };

  const spinnerSize = sizeMap[size];

  const loader = (
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Premium animated spinner */}
      <div
        style={{ width: spinnerSize, height: spinnerSize }}
        className="relative"
      >
        {/* soft glow */}
        <div className="absolute inset-0 rounded-full blur-md bg-blue-100 opacity-60 animate-pulse" />

        {/* outer ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-gray-200" />

        {/* animated gradient ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-600 border-r-indigo-500 animate-spin" />

        {/* center dot */}
        <div className="absolute inset-[30%] rounded-full bg-blue-600 shadow-md" />
      </div>

      {/* message */}
      <p className="text-black font-medium tracking-wide text-sm">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-[9999]">
        {loader}
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center py-10">
      {loader}
    </div>
  );
}