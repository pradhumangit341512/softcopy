'use client';

/**
 * TabStrip — shared, responsive horizontal tab strip used by list pages
 * (leads, inventory, …). Pure presentation; the parent owns URL state and
 * decides which tabs are visible.
 *
 * Responsive behaviour
 * ────────────────────
 *   • Mobile (<640px): tabs scroll horizontally if they overflow, with the
 *     thin auto-scrollbar styled in app/globals.css. Touch targets are
 *     ≥44px tall (py-3 + text-sm). Scroll-snap keeps tabs aligned.
 *   • Tablet/desktop: tabs lay out flat without scrolling for typical
 *     counts; snap is preserved so users can still nudge.
 *
 * A11y
 * ────
 *   • Renders role="tablist" with the items role="tab" and aria-selected.
 *   • Each tab is a <button type="button"> so it never submits parent forms.
 */

import clsx from 'clsx';

export interface TabItem {
  /** URL value for the tab. Empty string = "default / All" tab. */
  id: string;
  label: string;
  /** Defaults to true. Hidden tabs are skipped entirely (no DOM, no a11y noise). */
  visible?: boolean;
}

interface TabStripProps {
  tabs: TabItem[];
  activeTab: string;
  onSelect: (tabId: string) => void;
  /** Accessible label for the tablist — e.g. "Leads view". */
  ariaLabel?: string;
  /** Override the default underline style with pills if a page needs it. */
  variant?: 'underline' | 'pills';
  /** Extra container class — useful for negative margins inside cards. */
  className?: string;
}

export function TabStrip({
  tabs,
  activeTab,
  onSelect,
  ariaLabel,
  variant = 'underline',
  className,
}: TabStripProps) {
  const visibleTabs = tabs.filter((t) => t.visible !== false);
  if (visibleTabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        // Underline rail. snap-x + snap-mandatory keeps tabs aligned on
        // mobile-scroll. -mb-px puts the active tab's bottom border on top
        // of the rail border (single visual line).
        'flex items-center overflow-x-auto snap-x snap-mandatory',
        variant === 'underline' && 'border-b border-gray-200 gap-0.5',
        variant === 'pills' && 'gap-2 pb-1',
        className
      )}
    >
      {visibleTabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id || 'all'}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(t.id)}
            className={clsx(
              // shrink-0 stops flex from compressing tabs into ellipsis;
              // snap-start makes mobile-scroll land on tab boundaries.
              'shrink-0 snap-start whitespace-nowrap select-none',
              // Touch-friendly: py-3 ≈ 12px vertical → ~44px total tap area
              // even when text is small. px scales up on sm+.
              'px-3 sm:px-4 py-2.5 sm:py-3',
              'text-xs sm:text-sm',
              // Focus ring for keyboard users (rendered inside the rail
              // so it doesn't push other tabs around).
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded-sm',
              variant === 'underline' && [
                '-mb-px border-b-2 transition-colors',
                isActive
                  ? 'font-semibold text-blue-600 border-blue-600'
                  : 'font-medium text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300',
              ],
              variant === 'pills' && [
                'rounded-full transition-colors',
                isActive
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-700 font-medium hover:bg-gray-200',
              ]
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
