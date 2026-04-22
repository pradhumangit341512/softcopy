'use client';

/**
 * Floating WhatsApp "chat with us" bubble for marketing surfaces.
 *
 * Distinct from `WhatsAppButton` (which is the per-contact button shown
 * inside Client/Property rows). This one is the always-on support FAB
 * that appears on the public landing / privacy / terms / auth surfaces.
 *
 * Mounted once from `app/layout.tsx`; it uses `usePathname()` to hide
 * itself inside the authenticated app (`/dashboard`, `/superadmin`,
 * `/team`) and on the sign-in routes where a chat bubble would compete
 * with the in-app UI.
 *
 * The phone number literal is intentionally a `91XXXXXXXXXX` placeholder
 * — swap in the real number before public launch OR set
 * `NEXT_PUBLIC_WHATSAPP_NUMBER` in Vercel env and the env value wins.
 */

import { usePathname } from 'next/navigation';

// TODO: replace with the real Broker365 WhatsApp Business number before launch.
// If you set NEXT_PUBLIC_WHATSAPP_NUMBER in env the env value takes precedence.
const FALLBACK_NUMBER = '91XXXXXXXXXX';

const HIDE_ON_PREFIXES = [
  '/dashboard',
  '/superadmin',
  '/team',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

export function WhatsAppFAB() {
  const pathname = usePathname();
  if (!pathname) return null;

  // Hide inside the authenticated app + on sign-in surfaces. The FAB is a
  // public-marketing affordance; once a user is signed in they have real
  // support channels inside the product.
  if (HIDE_ON_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || FALLBACK_NUMBER;
  const href =
    `https://wa.me/${number}?text=` +
    encodeURIComponent("Hi Broker365 — I'd like to know more about onboarding my brokerage.");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Broker365 on WhatsApp"
      className="wa-fab wa-fab--floating"
    >
      {/* Pulse ring — pure CSS, respects prefers-reduced-motion via
          the stylesheet rule rather than a JS toggle. */}
      <span className="wa-fab__pulse" aria-hidden />
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A12.94 12.94 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3Zm0 23.6c-2 0-3.97-.54-5.69-1.56l-.41-.24-3.97 1.04 1.06-3.87-.27-.4A10.59 10.59 0 0 1 5.4 16c0-5.85 4.75-10.6 10.6-10.6 5.85 0 10.6 4.75 10.6 10.6 0 5.85-4.75 10.6-10.6 10.6Zm5.82-7.93c-.32-.16-1.9-.94-2.19-1.05-.3-.11-.5-.16-.72.16-.21.32-.83 1.05-1.02 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.58-1.59-.95-.85-1.6-1.9-1.79-2.21-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.72-1.74-.99-2.39-.26-.62-.53-.54-.72-.55-.19 0-.4-.02-.62-.02-.22 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.68 0 1.58 1.15 3.1 1.31 3.32.16.21 2.27 3.47 5.51 4.86.77.33 1.37.53 1.84.68.77.24 1.47.21 2.02.13.62-.1 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37Z" />
      </svg>
    </a>
  );
}
