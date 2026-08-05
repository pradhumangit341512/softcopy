import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import './landing.css';
import { ToastProvider } from '@/components/common/Toast';
import { WhatsAppFAB } from '@/components/common/WhatsAppFAB';
import { ConfirmProvider } from '@/components/common/ConfirmDialog';

// Fonts are self-hosted via next/font/local — the woff2 files live in
// app/fonts/ and are bundled at build time. This removes the compile-time
// fetch to Google's font servers (next/font/google), which on a slow or
// offline network stalled every cold build with "Request timed out after
// 3000ms / Retrying …" per family. Same zero-CLS / inline-CSS / preload
// benefits, no external DNS/TLS round-trip. Latin subset only, matching the
// prior config.

// App fonts. Inter is a variable font (single file spans the 100–900 axis).
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});

// Poppins is NOT a variable font, so each weight ships as its own file.
const poppins = localFont({
  src: [
    { path: './fonts/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/poppins-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});

// Landing-page fonts. Fraunces is variable with separate normal/italic files.
const fraunces = localFont({
  src: [
    { path: './fonts/fraunces-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/fraunces-latin-wght-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-fraunces',
  display: 'swap',
});

const manrope = localFont({
  src: './fonts/manrope-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-manrope',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// Root-level metadata. Per-page files (notably app/page.tsx) override the
// title/description/OG fields for their own surface — the values here act
// as fallbacks for any authenticated page that doesn't declare its own.
// Keep this in sync with the landing page's brand so dashboard tabs read
// "… · Broker365" instead of the old placeholder.
export const metadata: Metadata = {
  metadataBase: new URL('https://broker365.in'),
  title: {
    default: 'Broker365 CRM',
    template: '%s · Broker365',
  },
  description:
    'Broker365 — invite-only CRM for Indian real estate brokerages. Leads, inventory, pipeline, commissions, WhatsApp automation, and team analytics.',
  keywords: [
    'real estate CRM India',
    'broker CRM',
    'property management software',
    'lead management',
    'commission tracking',
    'Broker365',
  ],
  authors: [{ name: 'Broker365' }],
  creator: 'Broker365',
  // The landing page fills in its own full OG block. We keep a minimal
  // fallback here for authenticated pages (which are noindex anyway).
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

// Viewport configuration
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" />
        {/* next/font/local bundles the font files and emits its own
            preload hints automatically — manual ones aren't needed. */}

        {/* Analytics (optional) */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                `,
              }}
            />
          </>
        )}
      </head>

      <body
        suppressHydrationWarning={true}
        className={`${inter.variable} ${poppins.variable} ${fraunces.variable} ${manrope.variable} ${jetbrainsMono.variable} font-sans bg-white text-gray-900 antialiased`}
      >
        {/* Toast + Confirm providers — both expose imperative APIs
            (useToast, useConfirm). Confirm replaces window.confirm() in
            destructive flows so we get a consistent, branded modal. */}
        <ToastProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </ToastProvider>

        {/* Vercel Analytics — traffic + Core Web Vitals, no cookies. */}
        <Analytics />

        {/* Floating WhatsApp bubble. Self-hides on /dashboard, /superadmin,
            /team and every auth surface via usePathname() — visible only on
            public marketing + legal pages. */}
        <WhatsAppFAB />
      </body>
    </html>
  );
}