import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './ Button';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  submitText?: string;
  cancelText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({
  isOpen,
  title,
  children,
  onClose,
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-lg ${sizeClass[size]} w-full mx-4`}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </Button >
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {onSubmit && (
          <div className="flex justify-end gap-3 p-6 border-t">
            <Button variant="outline" onClick={onClose}>
              {cancelText}
            </Button>
            <Button onClick={onSubmit}>{submitText}</Button>
          </div>
        )}
      </div>
    </div>
  );
}