import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { rateLimit, clientKey } from '../../lib/server/rateLimit';
import { str, isEmail, isHoneypotTripped, type Errors } from '../../lib/server/validate';
import { notifyShelterOfEnquiry } from '../../lib/server/notify';

export const prerender = false;

const COLLECTION = 'Enquiries';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/** General contact form. Same shape as the subscribe route: server-only write. */
export const POST: APIRoute = async ({ request }) => {
  const limit = rateLimit(clientKey(request, 'enquiry'), 5, 60_000);
  if (!limit.ok) {
    return json({ status: 'error', message: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', message: 'Could not read that submission.' }, 400);
  }

  if (isHoneypotTripped(body)) return json({ status: 'ok' });

  const name = str(body.name, 120);
  const email = str(body.email, 254);
  const subject = str(body.subject, 200);
  const message = str(body.message, 4000);

  const errors: Errors = {};
  if (!name) errors.name = 'Please tell us your name.';
  if (!email) errors.email = 'Please enter your email address.';
  else if (!isEmail(email)) errors.email = 'That does not look like an email address.';
  if (!message) errors.message = 'Please tell us how we can help.';
  if (Object.keys(errors).length) return json({ status: 'invalid', errors }, 400);

  try {
    await items.insert(COLLECTION, {
      name, email,
      subject: subject || 'General enquiry',
      message,
      submittedAt: new Date(),
    });
    await notifyShelterOfEnquiry(name, email);
    return json({ status: 'ok', message: "Thank you — we'll come back to you within a couple of days." });
  } catch (err) {
    console.error('[api/enquiry] failed', err);
    return json({ status: 'error', message: 'Something went wrong our end. Please try again.' }, 500);
  }
};
