import { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  helper?: string;
}

export default function Input({
  label,
  error,
  icon,
  helper,
  className,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-800 mb-2">
          {label}
          {props.required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {icon}
          </div>
        )}

        <input
          {...props}
          className={clsx(
            `
            w-full
            px-4
            py-2
            border
            rounded-lg
            bg-white
            text-gray-900
            placeholder:text-gray-500
            placeholder:opacity-100
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500
            transition
            `,
            icon && 'pl-10',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300',
            className
          )}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-500">
          {error}
        </p>
      )}

      {helper && (
        <p className="mt-1 text-sm text-gray-500">
          {helper}
        </p>
      )}
    </div>
  );
}
