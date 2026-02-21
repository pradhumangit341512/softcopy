import { ReactNode, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string | number;
  label: string;
  icon?: ReactNode;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helper?: string;
  icon?: ReactNode;
  placeholder?: string;
}

export default function Select({
  label,
  options,
  error,
  helper,
  icon,
  placeholder = 'Select...',
  className,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}

        <select
          {...props}
          className={clsx(
            'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none',
            icon && 'pl-10',
            error && 'border-red-500 focus:ring-red-500',
            !error && 'border-gray-300',
            'bg-white cursor-pointer',
            className
          )}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={18}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {helper && <p className="mt-1 text-sm text-gray-500">{helper}</p>}
    </div>
  );
}
