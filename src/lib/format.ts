/**
 * Presentation helpers. Pure functions — no data fetching, no Wix imports,
 * so they can be used from both `.astro` frontmatter and React islands.
 */

/**
 * Ages are stored in months so the UI can choose its own wording.
 * 8 -> "8 months", 12 -> "1 year", 30 -> "2 years", 132 -> "11 years"
 */
export function formatAge(months?: number | null): string {
  if (months == null || Number.isNaN(months)) return 'Age unknown';
  const m = Math.max(0, Math.round(months));
  if (m < 12) return m === 1 ? '1 month' : `${m} months`;
  const years = Math.floor(m / 12);
  const rem = m % 12;
  const y = years === 1 ? '1 year' : `${years} years`;
  // Only mention leftover months for young animals, where it actually matters.
  if (years < 2 && rem > 0) return `${y}, ${rem} ${rem === 1 ? 'month' : 'months'}`;
  return y;
}

/** Age brackets used by the Adopt filters. */
export type AgeBracket = 'baby' | 'adult' | 'senior';

export function ageBracket(months?: number | null): AgeBracket | null {
  if (months == null) return null;
  if (months < 12) return 'baby';
  if (months < 96) return 'adult';   // 1–7 years
  return 'senior';                    // 8 years and over
}

export const AGE_BRACKET_LABELS: Record<AgeBracket, string> = {
  baby: 'Puppy / kitten (under 1)',
  adult: 'Adult (1–7)',
  senior: 'Senior (8+)',
};

/** "Free" reads better than "£0" for a waived fee. */
export function formatFee(amount?: number | null): string {
  if (amount == null) return 'Fee on application';
  if (amount === 0) return 'Fee waived';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export type AnimalStatus = 'Available' | 'Pending' | 'Adopted';

export function statusClass(status?: string | null): string {
  switch (status) {
    case 'Available': return 'badge badge--available';
    case 'Pending':   return 'badge badge--pending';
    case 'Adopted':   return 'badge badge--adopted';
    default:          return 'badge badge--adopted';
  }
}

/**
 * Deterministic hue per name, so an animal without a photo always gets the
 * same placeholder colour — it reads as intentional rather than random.
 * Hues are constrained to the warm/teal end of the wheel to stay on-brand.
 */
export function placeholderTone(seed: string): { from: string; to: string; ink: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const palettes = [
    { from: '#e4efed', to: '#c8ded9', ink: '#14504c' },
    { from: '#fbeade', to: '#f2d2bb', ink: '#8f3d1e' },
    { from: '#f2ebdf', to: '#e2d9c9', ink: '#5a5349' },
    { from: '#e7eee6', to: '#cfdccd', ink: '#2f5136' },
  ];
  return palettes[h % palettes.length];
}

/** Strip HTML to a plain string for meta descriptions and card excerpts. */
export function toPlain(html?: string | null, max = 160): string {
  if (!html) return '';
  const text = String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}
