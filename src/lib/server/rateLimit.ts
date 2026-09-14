/**
 * Best-effort in-process rate limiter for public form endpoints.
 *
 * Caveat worth knowing: this runs in a serverless environment, so the counter
 * lives only in one instance's memory. It will not stop a determined,
 * distributed attacker, and a cold start resets it. It is here to stop the
 * common case — one script hammering one endpoint — cheaply and without an
 * external dependency. If the shelter ever sees real abuse, this is the seam
 * to swap for a durable store (a Wix Data collection or an external KV).
 */

interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export interface RateLimitResult { ok: boolean; retryAfter: number }

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic sweep so the map cannot grow without bound.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size > MAX_KEYS) buckets.clear();
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Best available caller identifier behind Wix's proxy. */
export function clientKey(request: Request, scope: string): string {
  const h = request.headers;
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown';
  return `${scope}:${ip}`;
}
