import { useEffect, useState } from 'react';

/**
 * Header basket button with a live item count.
 *
 * Rendered client:only because the count comes from the visitor's cart
 * session — server-rendering it would paint a zero that then flickers to the
 * real number on hydration.
 *
 * Other components tell it to refresh by dispatching `cart:changed`, so
 * adding from a product page updates the header without a reload.
 */
export default function CartButton() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const res = await fetch('/api/cart');
        const body = await res.json();
        if (alive) setCount(body?.cart?.count ?? 0);
      } catch {
        if (alive) setCount(0);
      }
    }

    refresh();
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Prefer the count the event carries; fall back to re-reading.
      if (typeof detail?.count === 'number') setCount(detail.count);
      else refresh();
    };
    window.addEventListener('cart:changed', onChanged);
    return () => { alive = false; window.removeEventListener('cart:changed', onChanged); };
  }, []);

  const label = count && count > 0
    ? `Basket, ${count} ${count === 1 ? 'item' : 'items'}`
    : 'Basket, empty';

  return (
    <a className="cart-button" href="/cart" aria-label={label}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
        <path d="M4 6h16l-1.4 10.5a2 2 0 0 1-2 1.75H7.4a2 2 0 0 1-2-1.75L4 6Z"
              stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 6a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span aria-hidden="true">Basket</span>
      {count !== null && count > 0 && <span className="cart-count" aria-hidden="true">{count}</span>}
    </a>
  );
}
