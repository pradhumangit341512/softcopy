'use client';

/**
 * Client-side nav for the landing page. Handles the hamburger toggle,
 * scroll lock, ESC-to-close, and the mobile backdrop. Rendered once,
 * embedded by the Server Component at the top of the page.
 *
 * Kept deliberately small: everything else on the landing page is static
 * HTML rendered on the server, so this is the only hydration cost for
 * navigation.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Lock background scroll + ESC-to-close while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header role="banner">
      <nav className="nav" aria-label="Primary navigation">
        <div className="nav__inner">
          {/* Single-image lockup from /public/logo.svg — the SVG already
              contains both the icon and the "Broker365" wordmark, so no
              separate mark+wordmark spans are needed. `priority` because
              this logo is inside the fixed nav and visible on first paint. */}
          <a href="#top" className="brand brand--logo" onClick={closeMenu} aria-label="Broker365 home">
            <Image
              src="/logo.svg"
              alt="Broker365"
              width={720}
              height={160}
              priority
              className="brand__image"
            />
          </a>

          {menuOpen && (
            <button
              type="button"
              aria-label="Close menu"
              className="nav__backdrop"
              onClick={closeMenu}
            />
          )}

          <div id="mobile-menu" className={`nav__links ${menuOpen ? 'is-open' : ''}`}>
            <a href="#features" onClick={closeMenu}>Features</a>
            <a href="#modules" onClick={closeMenu}>Modules</a>
            <a href="#security" onClick={closeMenu}>Security</a>
            <a href="#pricing" onClick={closeMenu}>Pricing</a>
            <a href="#contact" onClick={closeMenu}>Onboarding</a>
          </div>

          {/* One sign-in button for every viewport. Lives outside the
              mobile-dropdown panel so there's exactly one button in the
              DOM at all times — no "two Subscriber sign-in buttons"
              visible when the dropdown opens on mobile. CSS shrinks the
              padding / font on small screens to keep it next to the
              hamburger without crowding the logo. */}
          <div className="nav__actions">
            <Link href="/login" className="btn btn--primary nav__cta" onClick={closeMenu}>
              Subscriber sign-in <span aria-hidden>→</span>
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen ? 'true' : 'false'}
            aria-controls="mobile-menu"
            className={`hamburger ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>
    </header>
  );
}
