import { SITE } from './site';

export interface SeoInput {
  /** Kept for readability and for matching the page in dashboard SEO settings. */
  pageName: string;
  title: string;
  description: string;
  /** Absolute URL of an image for social sharing. */
  image?: string;
  imageAlt?: string;
  /** og:type — "website" for most pages, "article" for an animal profile. */
  type?: 'website' | 'article';
}

/**
 * Resolve the canonical page URL.
 *
 * Behind Wix's TLS-terminating proxy `Astro.url` can carry the internal http
 * scheme, so the forwarded header is preferred when present and absolute.
 */
export function resolvePageUrl(request: Request, fallback: string): string {
  const forwarded = request.headers.get('x-wix-forwarded-url');
  if (forwarded && URL.canParse(forwarded)) {
    const proto = new URL(forwarded).protocol;
    if (proto === 'https:' || proto === 'http:') return forwarded;
  }
  return fallback;
}

export const siteName = SITE.name;
