import Link from 'next/link';
import Image from 'next/image';
import '../landing.css';

/**
 * Shared wrapper for /privacy and /terms so both pages inherit the landing
 * page's fonts + colour tokens without duplicating markup. Server Component
 * — no client JS needed for static legal text.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="b360 legal-shell">
      <header role="banner">
        <nav className="nav" aria-label="Primary navigation">
          <div className="nav__inner">
            <Link href="/" className="brand brand--logo" aria-label="Broker365 home">
              <Image
                src="/logo.svg"
                alt="Broker365"
                width={720}
                height={160}
                priority
                className="brand__image"
              />
            </Link>
            <div className="nav__actions">
              <Link href="/" className="btn btn--ghost">← Back to home</Link>
            </div>
          </div>
        </nav>
      </header>
      <main className="legal-main">{children}</main>
      <footer className="foot" role="contentinfo">
        <div className="foot__bar">
          <span>© {new Date().getFullYear()} Broker365 · All rights reserved.</span>
          <span>
            <Link href="/privacy">Privacy</Link>
            <span aria-hidden> · </span>
            <Link href="/terms">Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
