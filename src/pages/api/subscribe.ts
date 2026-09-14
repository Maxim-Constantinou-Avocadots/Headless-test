import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { rateLimit, clientKey } from '../../lib/server/rateLimit';
import { str, isEmail, isHoneypotTripped } from '../../lib/server/validate';

export const prerender = false;

const COLLECTION = 'Subscribers';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Derive a stable item id from the email address.
 *
 * This is how duplicates are prevented. The collection is admin-read, so this
 * route cannot query it to check whether an address is already subscribed —
 * a visitor-scoped read returns zero rows whether or not the row exists. But
 * inserting a second item with an id that already exists fails with WDE0074,
 * so a deterministic id turns "is this a duplicate?" into a write we can
 * simply attempt. It is hashed rather than using the raw address so that no
 * email is recoverable from an item id.
 */
async function subscriberId(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(`willowbrook:subscriber:${email}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Wix Data reports a duplicate id as WDE0074 / HTTP 409. */
function isDuplicate(err: unknown): boolean {
  const e = err as any;
  const code = e?.details?.applicationError?.code ?? e?.applicationError?.code ?? '';
  const message = String(e?.message ?? '');
  return code === 'WDE0074' || message.includes('WDE0074') || message.includes('already exists');
}

/**
 * Newsletter signup.
 *
 * The collection accepts inserts from visitors but is readable only by the
 * site owner, so subscriber addresses are never exposed. Validation, rate
 * limiting and the honeypot all run here rather than in the browser.
 */
export const POST: APIRoute = async ({ request }) => {
  const limit = rateLimit(clientKey(request, 'subscribe'), 5, 60_000);
  if (!limit.ok) {
    return json({ status: 'error', message: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', message: 'Could not read that submission.' }, 400);
  }

  // Bots get a success-shaped reply so they learn nothing; nothing is written.
  if (isHoneypotTripped(body)) return json({ status: 'ok' });

  const email = str(body.email, 254).toLowerCase();
  const firstName = str(body.firstName, 80);

  if (!email) return json({ status: 'error', field: 'email', message: 'Please enter your email address.' }, 400);
  if (!isEmail(email)) {
    return json({ status: 'error', field: 'email', message: 'That does not look like an email address.' }, 400);
  }

  try {
    const _id = await subscriberId(email);
    await items.insert(COLLECTION, {
      _id,
      email,
      firstName,
      source: 'footer',
      subscribedAt: new Date(),
      status: 'Subscribed',
    });
    return json({ status: 'ok', message: "You're on the list. Thank you." });
  } catch (err) {
    if (isDuplicate(err)) {
      return json({ status: 'duplicate', message: "You're already on the list — thanks again." });
    }
    console.error('[api/subscribe] failed', err);
    return json({ status: 'error', message: 'Something went wrong our end. Please try again.' }, 500);
  }
};
