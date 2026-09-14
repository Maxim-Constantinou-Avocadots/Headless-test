/**
 * Server-side validation. The browser validates too, for a better experience,
 * but this is the copy that decides whether anything is written — client
 * checks are a convenience, never a control.
 */

export type Errors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Deliberately permissive: UK numbers appear with spaces, +44, and (0).
const PHONE_RE = /^[+()\d][\d\s()-]{7,19}$/;

export function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function num(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 'on' || v === '1';
}

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v) && v.length <= 254;
}

export function isPhone(v: string): boolean {
  return PHONE_RE.test(v);
}

export function required(errors: Errors, field: string, value: string, label: string) {
  if (!value) errors[field] = `${label} is required.`;
}

/**
 * A hidden field people never see. Any value in it means a bot filled the
 * form in blind. We return a success-shaped response so the bot learns
 * nothing, but write nothing.
 */
export function isHoneypotTripped(data: Record<string, unknown>): boolean {
  return !!str(data.website) || !!str(data.company_url);
}
