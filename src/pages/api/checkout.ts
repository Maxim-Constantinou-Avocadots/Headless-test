import type { APIRoute } from 'astro';
import { currentCartV2 } from '@wix/ecom';
import { redirects } from '@wix/redirects';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Hands the basket over to Wix's hosted checkout.
 *
 * The `origin` is sent by the browser rather than read off the request.
 * Behind Wix's TLS-terminating proxy `new URL(request.url).origin` resolves
 * to http://, and the redirect allowlist treats http:// as a different,
 * unlisted origin — so the shopper gets a 403 on the way back from checkout.
 * We force https here as a second guard.
 */
export const POST: APIRoute = async ({ request }) => {
  let origin = '';
  try {
    const body = await request.json();
    origin = String(body.origin ?? '');
  } catch {
    /* origin stays empty and is validated below */
  }

  if (!origin) return json({ status: 'error', message: 'Missing origin.' }, 400);
  origin = origin.replace(/^http:\/\//i, 'https://').replace(/\/+$/, '');

  try {
    const { cart } = await currentCartV2.getCurrentCart();
    if (!cart?._id) {
      return json({ status: 'error', message: 'Your basket is empty.' }, 400);
    }

    const session = await redirects.createRedirectSession({
      // The cart's _id is the checkout id.
      ecomCheckout: { checkoutId: cart._id },
      callbacks: {
        postFlowUrl: `${origin}/shop`,
        thankYouPageUrl: `${origin}/shop/thank-you`,
      },
    });

    const url = session?.redirectSession?.fullUrl;
    if (!url) return json({ status: 'error', message: 'Could not start checkout.' }, 500);
    return json({ status: 'ok', url });
  } catch (err) {
    console.error('[api/checkout] failed', err);
    return json({ status: 'error', message: 'Could not start checkout. Please try again.' }, 500);
  }
};
