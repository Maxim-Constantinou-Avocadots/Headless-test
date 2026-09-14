import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
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
 * Newsletter signup.
 *
 * The Subscribers collection is admin-read and admin-write, so the browser
 * has no access to it at all. This route is the only way in: it validates,
 * rate limits, de-duplicates, and then writes with elevated permissions.
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
    // Check before inserting so a repeat signup is a friendly message,
    // not a duplicate row or an error.
    const findExisting = auth.elevate(
      async () => items.query(COLLECTION).eq('email', email).limit(1).find(),
    );
    const existing = await findExisting();
    if ((existing.items ?? []).length > 0) {
      return json({ status: 'duplicate', message: "You're already on the list — thanks again." });
    }

    const insert = auth.elevate(items.insert);
    await insert(COLLECTION, {
      email,
      firstName,
      source: 'footer',
      subscribedAt: new Date(),
      status: 'Subscribed',
    });

    return json({ status: 'ok', message: "You're on the list. Thank you." });
  } catch (err) {
    console.error('[api/subscribe] failed', err);
    return json({ status: 'error', message: 'Something went wrong our end. Please try again.' }, 500);
  }
};
