import { useEffect, useState } from 'react';
import type { CartView as Cart } from '../lib/store';

/**
 * Basket contents with quantity controls and the handoff to Wix checkout.
 *
 * Rendered client-side because the basket belongs to the visitor's session —
 * server-rendering it would show a stale or empty basket on a cached response.
 */
export default function CartView() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const res = await fetch('/api/cart');
      const body = await res.json();
      setCart(body.cart ?? { lines: [], count: 0, subtotal: '' });
    } catch {
      setError('We could not load your basket. Please refresh.');
      setCart({ lines: [], count: 0, subtotal: '' });
    }
  }

  async function mutate(action: string, lineItemId: string, quantity?: number) {
    setBusy(lineItemId);
    setError('');
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, lineItemId, quantity }),
      });
      const body = await res.json();
      if (body.status === 'ok') {
        setCart(body.cart);
        window.dispatchEvent(new CustomEvent('cart:changed', { detail: { count: body.cart?.count } }));
      } else {
        setError(body.message ?? 'Could not update your basket.');
      }
    } catch {
      setError('We could not reach the server. Please try again.');
    } finally {
      setBusy('');
    }
  }

  async function checkout() {
    setCheckingOut(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The origin must come from the browser: read off the request it
        // resolves to http:// behind the proxy, which the redirect allowlist
        // rejects when the shopper returns.
        body: JSON.stringify({ origin: window.location.origin }),
      });
      const body = await res.json();
      if (body.status === 'ok' && body.url) {
        window.location.href = body.url;
        return;
      }
      setError(body.message ?? 'Could not start checkout.');
    } catch {
      setError('We could not reach the server. Please try again.');
    } finally {
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
