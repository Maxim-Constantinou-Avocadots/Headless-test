import { currentCartV2 } from '@wix/ecom';
import { redirects } from '@wix/redirects';
import { imageUrl } from './media';

/**
 * Cart operations, run in the BROWSER.
 *
 * This deliberately does not go through a server route. On Wix headless the
 * visitor session lives in the browser's Wix client context — no session
 * cookie is sent to the server — so `currentCartV2` called from a server
 * endpoint gets a fresh anonymous cart on every request. Adding an item
 * appears to work and then vanishes on the next read. Calling from the
 * browser uses the visitor's real, persistent cart.
 *
 * Nothing secret is involved: these are visitor-scoped calls authenticated by
 * the same public context the rest of the storefront uses.
 */

export const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';

export interface CartLine {
  _id: string;
  name: string;
  quantity: number;
  price: string;
  image: string;
}

export interface CartView {
  lines: CartLine[];
  count: number;
  subtotal: string;
}

export const EMPTY_CART: CartView = { lines: [], count: 0, subtotal: '' };

/** Cart V2 money carries no formatted string, so format it here. */
function formatMoney(money: any, cart: any): string {
  const value = money?.convertedAmount ?? money?.amount;
  const currency = cart?.customerInfo?.currencyCode ?? cart?.businessInfo?.currencyCode ?? 'GBP';
  if (value == null) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
}

function toView(cart: any, subtotal: string): CartView {
  const lines: CartLine[] = (cart?.lineItems ?? []).map((li: any) => ({
    _id: li._id,
    name: li.name?.original ?? 'Item',
    quantity: li.quantityInfo?.confirmedQuantity ?? li.quantity ?? 0,
    price: formatMoney(li.pricing?.totalPrice ?? li.pricing?.unitPrice, cart),
    image: imageUrl(li.attributes?.image ?? li.image ?? '', 200, 200),
  }));
  return { lines, count: lines.reduce((n, l) => n + l.quantity, 0), subtotal };
}

async function readCart(): Promise<CartView> {
  const { cart } = await currentCartV2.getCurrentCart();
  let subtotal = '';
  try {
    const est = await currentCartV2.estimateCurrentCart();
    subtotal = formatMoney(est?.summary?.priceSummary?.subtotal, cart);
  } catch {
    subtotal = '';
  }
  return toView(cart, subtotal);
}

/** An empty cart throws on some paths — treat that as empty, not an error. */
export async function getCart(): Promise<CartView> {
  try {
    return await readCart();
  } catch {
    return EMPTY_CART;
  }
}

export async function addToCart(
  productId: string,
  variantId: string,
  quantity: number,
): Promise<CartView> {
  await currentCartV2.addLineItemsToCurrentCart({
    catalogItems: [{
      quantity,
      catalogReference: {
        catalogItemId: productId,
        appId: STORES_APP_ID,
        // Mandatory for any product that has variants.
        ...(variantId ? { options: { variantId } } : {}),
      },
    }],
  });
  return readCart();
}

export async function setQuantity(lineItemId: string, quantity: number): Promise<CartView> {
  if (quantity <= 0) return removeLine(lineItemId);
  await currentCartV2.updateLineItemsInCurrentCart({
    lineItems: [{ lineItemId, quantity: { newQuantity: quantity } }],
  });
  return readCart();
}

export async function removeLine(lineItemId: string): Promise<CartView> {
  await currentCartV2.removeLineItemsFromCurrentCart([lineItemId]);
  return readCart();
}

/**
 * Hand the basket to Wix's hosted checkout.
 *
 * The origin must be the https:// published host — the redirect allowlist
 * treats http://<same host> as a different, unlisted origin and 403s the
 * shopper on the way back.
 */
export async function startCheckout(): Promise<string> {
  const { cart } = await currentCartV2.getCurrentCart();
  if (!cart?._id) throw new Error('Your basket is empty.');

  const origin = window.location.origin.replace(/^http:\/\//i, 'https://');
  const session = await redirects.createRedirectSession({
    // The cart's _id is the checkout id.
    ecomCheckout: { checkoutId: cart._id },
    callbacks: {
      postFlowUrl: `${origin}/shop`,
      thankYouPageUrl: `${origin}/shop/thank-you`,
    },
  });

  const url = session?.redirectSession?.fullUrl;
  if (!url) throw new Error('Could not start checkout.');
  return url;
}

/** Tell the header badge (and anything else listening) that the cart changed. */
export function announceCartChange(count: number) {
  window.dispatchEvent(new CustomEvent('cart:changed', { detail: { count } }));
}
