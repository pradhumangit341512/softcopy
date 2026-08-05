'use client';

/**
 * WhatsApp + Email share buttons for a listing (F17b). Given a ready-made
 * message `text` (built by formatUnitListing) and an email `subject`, renders
 * two link buttons that open a WhatsApp share sheet and the user's mail client.
 *
 * The WhatsApp link uses wa.me WITHOUT a number, so it opens the contact
 * picker — the user shares the listing with anyone, not just the unit owner.
 */

import { MessageCircle, Mail } from 'lucide-react';
import { buildWhatsAppShareUrl, buildMailtoUrl } from '@/lib/unit-options';

export function ShareListingButtons({
  text,
  subject,
  size = 'sm',
  className = '',
}: {
  text: string;
  subject: string;
  /** 'sm' = compact icons for table rows; 'md' = labelled pills for headers. */
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (size === 'md') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a
          href={buildWhatsAppShareUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors"
        >
          <MessageCircle size={15} /> WhatsApp
        </a>
        <a
          href={buildMailtoUrl(subject, text)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
        >
          <Mail size={15} /> Email
        </a>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <a
        href={buildWhatsAppShareUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        title="Share on WhatsApp"
        className="w-6 h-6 rounded border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center"
      >
        <MessageCircle size={11} />
      </a>
      <a
        href={buildMailtoUrl(subject, text)}
        aria-label="Share via email"
        title="Share via email"
        className="w-6 h-6 rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
      >
        <Mail size={11} />
      </a>
    </div>
  );
}
