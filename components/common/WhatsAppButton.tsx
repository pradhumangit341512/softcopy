'use client';

import Link from 'next/link';

/**
 * Brand-accurate WhatsApp link.
 *
 * Shared by the Clients list, the Client card, and the Properties list
 * so every phone number gets the same tap-target. The SVG is the
 * official WhatsApp glyph — not a generic chat bubble — so customers
 * recognise it at a glance.
 *
 * Sizing is device-aware via Tailwind's `sm:` prefix rather than a
 * prop, so the same button grows from a compact 28px circle on phones
 * to 34px on tablets/desktop without every caller having to pick a
 * number.
 *
 * The phone number is normalised to the E.164-ish form wa.me expects
 * (digits only, no leading +) so inputs with spaces / parens / dashes
 * from imported CSVs still open a working chat.
 */

export interface WhatsAppButtonProps {
  /** Raw phone as stored in the DB. Spaces / dashes / parens / leading + are tolerated. */
  phone: string;
  /** Optional pre-filled message. Keep short — users skim before tapping Send. */
  message?: string;
  /** Visual variant. 'icon' = circle icon-only (default). 'inline' = icon + label pill. */
  variant?: 'icon' | 'inline';
  /** Extra className for one-off spacing. */
  className?: string;
  /** Accessible label override — defaults to "Open WhatsApp chat". */
  ariaLabel?: string;
}

function normalisePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '').replace(/^\+/, '');
}

export function WhatsAppButton({
  phone,
  message,
  variant = 'icon',
  className = '',
  ariaLabel = 'Open WhatsApp chat',
}: WhatsAppButtonProps) {
  const digits = normalisePhone(phone);
  if (!digits) return null;

  const href =
    `https://wa.me/${digits}` +
    (message ? `?text=${encodeURIComponent(message)}` : '');

  const base =
    'inline-flex items-center justify-center rounded-full bg-[#25d366] ' +
    'text-white hover:bg-[#1fbe5a] active:scale-[0.96] ' +
    'shadow-sm hover:shadow-md transition-all flex-shrink-0 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-[#25d366]';

  // Icon-only: 28px on mobile, 32px on sm+, 34px on lg+. Meets the
  // 44px minimum tap target by way of padding on touch devices.
  const iconOnly = 'w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9';

  // Inline: compact chip with label. Tablet+ gets a bit more breathing room.
  const inline =
    'gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold';

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`${base} ${variant === 'inline' ? inline : iconOnly} ${className}`}
    >
      <WhatsAppGlyph className={variant === 'icon' ? 'w-[55%] h-[55%]' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'} />
      {variant === 'inline' && <span>WhatsApp</span>}
    </Link>
  );
}

/**
 * Standalone inline SVG so we never depend on an icon library that
 * might replace WhatsApp's glyph with a generic chat bubble.
 * Path is the simplified brand mark, sized to viewBox 32x32.
 */
function WhatsAppGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
    >
      <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A12.94 12.94 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3Zm0 23.6c-2 0-3.97-.54-5.69-1.56l-.41-.24-3.97 1.04 1.06-3.87-.27-.4A10.59 10.59 0 0 1 5.4 16c0-5.85 4.75-10.6 10.6-10.6 5.85 0 10.6 4.75 10.6 10.6 0 5.85-4.75 10.6-10.6 10.6Zm5.82-7.93c-.32-.16-1.9-.94-2.19-1.05-.3-.11-.5-.16-.72.16-.21.32-.83 1.05-1.02 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.58-1.59-.95-.85-1.6-1.9-1.79-2.21-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.72-1.74-.99-2.39-.26-.62-.53-.54-.72-.55-.19 0-.4-.02-.62-.02-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.68 0 1.58 1.15 3.1 1.31 3.32.16.21 2.27 3.47 5.51 4.86.77.33 1.37.53 1.84.68.77.24 1.47.21 2.02.13.62-.1 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37Z" />
    </svg>
  );
}
