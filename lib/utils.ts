/** Format a numeric amount as Indian-locale currency string */
export function formatCurrency(amount: number, currency: string = '₹'): string {
  return `${currency}${amount.toLocaleString('en-IN')}`;
}

/** Format a phone number string as XXX-XXX-XXXX */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
}

/** Format a date value to a human-readable Indian-locale string (e.g. "05 Apr 2025") */
export function formatDate(date?: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Calculate the number of days from today until the given date */
export function getDaysUntil(date: Date | string): number {
  const target = new Date(date);
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Return Tailwind CSS classes for a given client status */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    New: 'bg-blue-100 text-blue-800',
    Interested: 'bg-yellow-100 text-yellow-800',
    DealDone: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/** Generate a unique invoice number using timestamp and random suffix */
export function generateInvoiceNumber(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

/** Standard chart color palette used across all chart components */
export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/** Recharts tooltip payload entry */
export interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

/** Props for the shared custom tooltip component */
export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}