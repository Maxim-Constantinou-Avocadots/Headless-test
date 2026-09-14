import type { APIRoute } from 'astro';
import { currentCartV2 } from '@wix/ecom';
import { getCart, STORES_APP_ID } from '../../lib/store';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Cart operations run as the visitor, not elevated — the cart belongs to
 * their session. These endpoints exist so the browser never has to resolve
 * wix:image:// URIs or format Cart V2 money itself.
 */

/** Current cart contents, ready to render. */
export const GET: APIRoute = async () => {
  try {
    return json({ status: 'ok', cart: await getCart() });
  } catch (err) {
    console.error('[api/cart] read failed', err);
    return json({ status: 'error', cart: { lines: [], count: 0, subtotal: '' } }, 500);
  }
};

/** Add, update quantity, or remove. */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', message: 'Could not read that request.' }, 400);
  }

  const action = String(body.action ?? 'add');

  try {
    if (action === 'add') {
      const productId = String(body.productId ?? '');
      const variantId = String(body.variantId ?? '');
      const quantity = Math.max(1, Number(body.quantity) || 1);
      if (!productId) return json({ status: 'error', message: 'Missing product.' }, 400);

      await currentCartV2.addLineItemsToCurrentCart({
        catalogItems: [{
          quantity,
          catalogReference: {
            catalogItemId: productId,
            appId: STORES_APP_ID,
            // Mandatory for any product with variants — an add without it
            // is rejected outright.
            ...(variantId ? { options: { variantId } } : {}),
          },
        }],
      });
    } else if (action === 'update') {
      const lineItemId = String(body.lineItemId ?? '');
      const quantity = Number(body.quantity);
      if (!lineItemId || !Number.isFinite(quantity)) {
        return json({ status: 'error', message: 'Missing line item.' }, 400);
      }
      if (quantity <= 0) {
        await currentCartV2.removeLineItemsFromCurrentCart([lineItemId]);
      } else {
        await currentCartV2.updateCurrentCartLineItemQuantity([{ _id: lineItemId, quantity }]);
      }
    } else if (action === 'remove') {
      const lineItemId = String(body.lineItemId ?? '');
      if (!lineItemId) return json({ status: 'error', message: 'Missing line item.' }, 400);
      await currentCartV2.removeLineItemsFromCurrentCart([lineItemId]);
    } else {
      return json({ status: 'error', message: 'Unknown action.' }, 400);
    }

    return json({ status: 'ok', cart: await getCart() });
  } catch (err: any) {
    console.error('[api/cart] %s failed', action, err);
    const message = String(err?.message ?? '');
    // Surface the one failure a shopper can actually act on.
    if (/inventory|stock/i.test(message)) {
      return json({ status: 'error', message: 'Sorry — there is not enough stock left for that.' }, 409);
    }
    return json({ status: 'error', message: 'Could not update your basket. Please try again.' }, 500);
  }
};
