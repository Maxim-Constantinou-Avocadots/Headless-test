import type { APIRoute } from 'astro';
import { getAllAnimals } from '../lib/animals';
import { getProducts } from '../lib/store';
import { resolvePageUrl } from '../lib/seo';

export const prerender = false;

/**
 * Sitemap for the whole site.
 *
 * Served at /sitemap-pages.xml rather than /sitemap.xml because Wix reserves
 * the latter at the platform level and answers it with its own 404 before the
 * request reaches Astro. The site's robots.txt is updated to point here.
 * Animal and product URLs are read live, so anything the shelter adds in the
 * dashboard appears here without a republish.
 *
 * The thank-you pages, the basket and 404 are deliberately absent: they are
 * noindex, and listing them would contradict that.
 */

const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/',        priority: '1.0', changefreq: 'daily' },
  { path: '/adopt',   priority: '0.9', changefreq: 'daily' },
  { path: '/shop',    priority: '0.7', changefreq: 'weekly' },
  { path: '/about',   priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/apply',   priority: '0.8', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.2', changefreq: 'yearly' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ request, url }) => {
  const origin = new URL(resolvePageUrl(request, url.href)).origin.replace(/^http:/, 'https:');

  const entries: string[] = STATIC_PAGES.map(
    (p) => `  <url>
    <loc>${escapeXml(origin + p.path)}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  );

  // Both reads are guarded: a sitemap missing its item pages is far better
  // than a sitemap that 500s.
  try {
    const { animals } = await getAllAnimals();
    for (const a of animals) {
      if (!a.slug) continue;
      entries.push(`  <url>
    <loc>${escapeXml(`${origin}/adopt/${a.slug}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${a.status === 'Available' ? '0.8' : '0.4'}</priority>
  </url>`);
    }
  } catch (err) {
    console.error('[sitemap] animals failed', err);
  }

  try {
    const { products } = await getProducts();
    for (const p of products) {
      if (!p.slug) continue;
      entries.push(`  <url>
    <loc>${escapeXml(`${origin}/shop/${p.slug}`)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }
  } catch (err) {
    console.error('[sitemap] products failed', err);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
