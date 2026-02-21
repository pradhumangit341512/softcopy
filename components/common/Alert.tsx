import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';
import Button from './ Button';

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string | ReactNode;
  onClose?: () => void;
  closeable?: boolean;
  icon?: ReactNode;
}

export default function Alert({
  type = 'info',
  title,
  message,
  onClose,
  closeable = true,
  icon,
}: AlertProps) {
  const iconMap = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const styles = {
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: 'text-green-600',
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: 'text-red-600',
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: 'text-yellow-600',
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: 'text-blue-600',
    },
  };

  const style = styles[type];

  return (
    <div
      className={clsx(
        'border-l-4 p-4 rounded-r-lg flex items-start gap-3',
        style.container
      )}
      role="alert"
    >
      <div className={clsx('shrink-0', style.icon)}>
        {icon || iconMap[type]}
      </div>

      <div className="grow">
        {title && <h3 className="font-semibold mb-1">{title}</h3>}
        <p className="text-sm">{message}</p>
      </div>

      {closeable && onClose && (
        <Button
          onClick={onClose}
          className="shrink-0 ml-2 text-current opacity-70 hover:opacity-100 transition"
        >
          <X size={18} />
        </Button>
      )}
    </div>
  );
}