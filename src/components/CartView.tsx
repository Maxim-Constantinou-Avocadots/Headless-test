import { useEffect, useState } from 'react';
import {
  getCart, setQuantity, removeLine, startCheckout, announceCartChange,
  type CartView as Cart,
} from '../lib/cart-client';

/**
 * Basket contents with quantity controls and the handoff to Wix checkout.
 *
 * All basket operations run here in the browser. The visitor's cart session
 * lives in the browser's Wix context rather than in a cookie, so the same
 * calls made from a server route would act on a fresh, empty cart.
 */
export default function CartView() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setCart(await getCart());
    } catch {
      setError('We could not load your basket. Please refresh.');
      setCart({ lines: [], count: 0, subtotal: '' });
    }
  }

  async function mutate(action: 'update' | 'remove', lineItemId: string, quantity?: number) {
    setBusy(lineItemId);
    setError('');
    try {
      const next = action === 'remove'
        ? await removeLine(lineItemId)
        : await setQuantity(lineItemId, quantity ?? 0);
      setCart(next);
      announceCartChange(next.count);
    } catch (err: any) {
      setError(
        /inventory|stock/i.test(String(err?.message ?? ''))
          ? 'Sorry — there is not enough stock left for that.'
          : 'Could not update your basket. Please try again.',
      );
    } finally {
      setBusy('');
    }
  }

  async function checkout() {
    setCheckingOut(true);
    setError('');
    try {
      window.location.href = await startCheckout();
      return;
    } catch (err: any) {
      setError(String(err?.message ?? '') || 'Could not start checkout. Please try again.');
      setCheckingOut(false);
    }
  }

  if (cart === null) {
    return (
      <div className="cart-skeleton" aria-busy="true" aria-live="polite">
        <span className="visually-hidden">Loading your basket…</span>
        {[0, 1].map((i) => (
          <div key={i} className="cart-skeleton-row">
            <div className="skeleton cart-skeleton-img" />
            <div className="cart-skeleton-lines">
              <div className="skeleton" style={{ height: '1rem', width: '60%' }} />
              <div className="skeleton" style={{ height: '1rem', width: '30%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="empty">
        <h2>Your basket is empty</h2>
        <p className="muted">
          Everything in the shop pays for food, bedding and vet bills.
        </p>
        <a className="btn btn--primary" href="/shop">Visit the shop</a>
      </div>
    );
  }

  return (
    <div className="cart">
      {error && <p className="alert alert--error cart-error" role="alert">{error}</p>}

      <ul className="cart-lines">
        {cart.lines.map((line) => (
          <li key={line._id} className="cart-line">
            {line.image
              ? <img src={line.image} alt="" width="90" height="90" loading="lazy" />
              : <div className="cart-line-noimg" aria-hidden="true" />}

            <div className="cart-line-main">
              <p className="cart-line-name">{line.name}</p>
              <p className="cart-line-price">{line.price}</p>
            </div>

            <div className="cart-line-qty">
              <label htmlFor={`qty-${line._id}`} className="visually-hidden">
                Quantity for {line.name}
              </label>
              <button
                type="button"
                className="qty-step"
                onClick={() => mutate('update', line._id, line.quantity - 1)}
                disabled={busy === line._id}
                aria-label={`Reduce quantity of ${line.name}`}
              >−</button>
              <input
                id={`qty-${line._id}`}
                type="number"
                min={0}
                value={line.quantity}
                onChange={(e) => mutate('update', line._id, Math.max(0, Number(e.target.value) || 0))}
                disabled={busy === line._id}
              />
              <button
                type="button"
                className="qty-step"
                onClick={() => mutate('update', line._id, line.quantity + 1)}
                disabled={busy === line._id}
                aria-label={`Increase quantity of ${line.name}`}
              >+</button>
            </div>

            <button
              type="button"
              className="cart-remove"
              onClick={() => mutate('remove', line._id)}
              disabled={busy === line._id}
            >
              Remove<span className="visually-hidden"> {line.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="cart-footer">
        <p className="cart-subtotal">
          <span>Subtotal</span>
          <strong>{cart.subtotal || '—'}</strong>
        </p>
        <p className="muted cart-postage">Postage is calculated at checkout.</p>
        <button
          type="button"
          className="btn btn--primary cart-checkout"
          onClick={checkout}
          disabled={checkingOut}
        >
          {checkingOut ? 'Taking you to checkout…' : 'Go to checkout'}
        </button>
        <p className="cart-continue"><a href="/shop">Continue shopping</a></p>
      </div>
    </div>
  );
}
