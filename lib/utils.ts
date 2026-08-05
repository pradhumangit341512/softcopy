/**
 * Escape regex metacharacters so a user-supplied string can be used safely as
 * a literal inside a regex-backed query.
 *
 * Prisma's MongoDB connector compiles `contains`/`startsWith`/`endsWith` into a
 * `$regex`, passing the value through unescaped. An unbalanced metacharacter
 * (e.g. a lone `(` in a search like "Flat (2BHK)") is an invalid pattern and
 * makes MongoDB throw, surfacing as a 500. Escaping turns the term into a true
 * literal substring match, which is the intended search behavior anyway.
 *
 * @param input Raw, untrusted search term.
 * @returns The term with all regex metacharacters backslash-escaped.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Format a numeric amount as Indian-locale currency string */
export function formatCurrency(amount: number, currency: string = '₹'): string {
  return `${currency}${amount.toLocaleString('en-IN')}`;
}

/**
 * Compact Indian-currency shorthand for large amounts:
 *   1,25,00,000 → "₹1.25 Cr"   ·   58,50,000 → "₹58.5 L"   ·   9,500 → "₹9,500"
 * Trailing zeros are trimmed (₹2 Cr, not ₹2.00 Cr). Used in tight table/card
 * cells; the full number stays available via formatCurrency for tooltips.
 */
export function formatCompactINR(amount: number, currency: string = '₹'): string {
  const trim = (n: number) => String(Math.round(n * 100) / 100);
  if (amount >= 1e7) return `${currency}${trim(amount / 1e7)} Cr`;
  if (amount >= 1e5) return `${currency}${trim(amount / 1e5)} L`;
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

/**
 * Compact relative time for "last activity" labels, e.g. "just now", "3h ago",
 * "2d ago", "5w ago". Falls back to an absolute date past ~1 year so it never
 * reads as a vague "53w ago". Returns '' for missing/invalid input.
 */
export function timeAgo(date?: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 0) return formatDate(d); // future date — show the absolute date, not "just now"
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 7)}w ago`;
  return formatDate(d);
}

/** Calculate the number of days from today until the given date */
export function getDaysUntil(date: Date | string): number {
  const target = new Date(date);
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Classify a follow-up date as overdue, today, tomorrow, or future */
export function getFollowUpStatus(date: Date | string | undefined | null): { label: string; style: string; key: 'overdue' | 'today' | 'tomorrow' | 'future' } | null {
  if (!date) return null;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, style: 'text-red-600 bg-red-50', key: 'overdue' };
  if (diffDays === 0) return { label: 'Today', style: 'text-amber-700 bg-amber-50', key: 'today' };
  if (diffDays === 1) return { label: 'Tomorrow', style: 'text-blue-600 bg-blue-50', key: 'tomorrow' };
  return { label: `in ${diffDays}d`, style: 'text-green-700 bg-green-50', key: 'future' };
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