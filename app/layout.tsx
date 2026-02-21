import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/common/Toast';

// Import fonts
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
});

// Metadata
export const metadata: Metadata = {
  title: 'Real Estate CRM - Manage Your Property Business',
  description:
    'Complete CRM solution for real estate builders and brokers. Manage clients, track visits, follow-ups, and commissions.',
  keywords: [
    'real estate',
    'CRM',
    'property management',
    'sales tracking',
    'commission tracking',
  ],
  authors: [{ name: 'Real Estate CRM' }],
  creator: 'Real Estate CRM Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://realestate-crm.com',
    title: 'Real Estate CRM',
    description: 'Complete CRM solution for real estate professionals',
    siteName: 'Real Estate CRM',
    images: [
      {
        url: 'https://realestate-crm.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Real Estate CRM',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real Estate CRM',
    description: 'Complete CRM solution for real estate professionals',
    images: ['https://realestate-crm.com/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
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

      <body className={`${inter.variable} ${poppins.variable} bg-white text-gray-900`}>
        {/* Toast Provider Wrapper */}
        <ToastProvider>
          {/* Main Content */}
          {children}
        </ToastProvider>

        {/* Analytics Tracking */}
        <noscript>
          <div>
            JavaScript is required to use this application. Please enable JavaScript
            in your browser settings.
          </div>
        </noscript>
      </body>
    </html>
  );
}