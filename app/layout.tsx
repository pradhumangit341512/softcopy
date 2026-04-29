import type { Metadata } from 'next';
import { Inter, Poppins, Fraunces, Manrope, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import './landing.css';
import { ToastProvider } from '@/components/common/Toast';
import { WhatsAppFAB } from '@/components/common/WhatsAppFAB';
import { ConfirmProvider } from '@/components/common/ConfirmDialog';

// App fonts
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
});

// Landing-page fonts — self-hosted by next/font/google (zero CLS, no external
// DNS/TLS round-trip on first paint, and the font CSS ships inline in the
// initial HTML so the landing page never shows an unstyled flash.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
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
        {/* next/font/google self-hosts the font files and emits its own
            preconnect/preload hints automatically — manual ones aren't needed. */}

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