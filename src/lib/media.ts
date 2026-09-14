import { media } from '@wix/sdk';

/**
 * Wix media fields come back as `wix:image://v1/<hash>/<file>#…` identifiers,
 * not URLs. Hand-building a static.wixstatic.com URL gets the format wrong and
 * the image 403s, so always resolve through the SDK.
 *
 * Returns an empty string when there is nothing to show, so callers can fall
 * back to a themed block rather than rendering a broken <img>.
 */
export function imageUrl(value: unknown, width = 900, height = 700): string {
  if (!value) return '';
  try {
    if (typeof value === 'string') {
      if (value.startsWith('wix:image://')) {
        // getScaledToFillImageUrl returns the URL string directly — no .url.
        return media.getScaledToFillImageUrl(value, width, height, {});
      }
      return value.startsWith('http') ? value : '';
    }
    // Media-gallery entries and some IMAGE fields arrive as objects.
    const obj = value as { url?: string; src?: string; image?: string | { url?: string } };
    if (typeof obj.image === 'string') return imageUrl(obj.image, width, height);
    if (obj.image && typeof obj.image === 'object' && obj.image.url) {
      return imageUrl(obj.image.url, width, height);
    }
    return imageUrl(obj.url ?? obj.src ?? '', width, height);
  } catch {
    return '';
  }
}

/** Resolve a MEDIA_GALLERY field to a list of usable URLs. */
export function galleryUrls(value: unknown, width = 1200, height = 900): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => imageUrl(entry, width, height)).filter(Boolean);
}
