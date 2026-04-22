import type { MetadataRoute } from 'next';

/**
 * sitemap.xml served at /sitemap.xml.
 *
 * Only public, indexable URLs belong here. The authenticated surfaces
 * (/dashboard, /superadmin, /team) are both disallowed in robots.txt
 * AND absent from this sitemap so crawlers have no reason to try them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://broker365.in';
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${base}/forgot-password`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Google deduplicates fragment URLs to the parent page, so this
    // entry doesn't get its own result — it's here so AI crawlers that
    // actually honour fragment-level entries (some do) can jump straight
    // to the FAQ block without re-parsing the whole page.
    {
      url: `${base}/#faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
