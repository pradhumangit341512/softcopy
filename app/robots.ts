import type { MetadataRoute } from 'next';

/**
 * robots.txt served at /robots.txt.
 *
 * We expose the marketing pages (/, /login, /forgot-password) and keep
 * crawlers out of every authenticated surface so they don't waste crawl
 * budget on the dashboard, superadmin console, or API routes (all of
 * which redirect to /login for unauthenticated requests anyway).
 */
export default function robots(): MetadataRoute.Robots {
  const base = 'https://broker365.in';
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/login',
          '/forgot-password',
          '/reset-password',
          '/privacy',
          '/terms',
          // Explicit allow so AI crawlers (ChatGPT, Perplexity, Claude)
          // reliably fetch the ingestion-friendly summary at /llms.txt
          // even when aggressive proxies default to deny.
          '/llms.txt',
        ],
        disallow: [
          '/dashboard',
          '/superadmin',
          '/team',
          '/api',
          '/_next',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
