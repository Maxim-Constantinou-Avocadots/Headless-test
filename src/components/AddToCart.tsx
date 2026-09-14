import { useMemo, useState } from 'react';
import type { Variant } from '../lib/store';
import { addToCart, announceCartChange } from '../lib/cart-client';

interface Props {
  productId: string;
  productName: string;
  variants: Variant[];
  /** Product-level stock, used when there are no options to choose. */
  inStock: boolean;
}

/**
 * Variant picker, quantity and add-to-cart.
 *
 * Option selections are resolved to a concrete variantId before the add —
 * Cart V2 rejects an add for a variant-bearing product without one.
 */
export default function AddToCart({ productId, productName, variants, inStock }: Props) {
  // Derive the option names and their choices from the variants themselves,
  // preserving the order the catalogue returns them in.
  const options = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of variants) {
      for (const [name, choice] of Object.entries(v.choices)) {
        const list = map.get(name) ?? [];
        if (!list.includes(choice)) list.push(choice);
        map.set(name, list);
      }
    }
    return [...map.entries()].map(([name, choices]) => ({ name, choices }));
  }, [variants]);

  const [selection, setSelection] = useState<Record<string, string>>(() => {
    // Preselect the first in-stock combination so the page is usable immediately.
    const firstAvailable = variants.find((v) => v.inStock) ?? variants[0];
    return firstAvailable ? { ...firstAvailable.choices } : {};
  });
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const matched = useMemo(() => {
    if (options.length === 0) return variants[0] ?? null;
    return variants.find((v) =>
      options.every((o) => v.choices[o.name] === selection[o.name])) ?? null;
  }, [variants, options, selection]);

  const available = options.length === 0
    ? inStock && (variants[0]?.inStock ?? inStock)
    : Boolean(matched?.inStock);

  /** Is this choice in stock given everything else currently selected? */
  function choiceAvailable(optionName: string, choice: string): boolean {
    return variants.some((v) =>
      v.choices[optionName] === choice &&
      v.inStock &&
      options.every((o) => o.name === optionName || v.choices[o.name] === selection[o.name]));
  }

  async function add() {
    if (!available || status === 'adding') return;
    setStatus('adding');
    setMessage('');

    try {
      const cart = await addToCart(productId, matched?.variantId ?? '', quantity);
      setStatus('added');
      setMessage(`${productName} added to your basket.`);
      // Update the header badge without a reload.
      announceCartChange(cart.count);
    } catch (err: any) {
      setStatus('error');
      setMessage(
        /inventory|stock/i.test(String(err?.message ?? ''))
          ? 'Sorry — there is not enough stock left for that.'
          : 'Could not add that to your basket. Please try again.',
      );
    }
  }

  return (
    <div className="atc">
      {options.map((o) => (
        <fieldset key={o.name} className="atc-option">
          <legend className="fieldset-legend">{o.name}</legend>
          <div className="atc-choices">
            {o.choices.map((choice) => {
              const selected = selection[o.name] === choice;
              const canPick = choiceAvailable(o.name, choice);
              const id = `opt-${o.name}-${choice}`.replace(/\s+/g, '-');
              return (
                <span key={choice} className="atc-choice">
                  <input
                    type="radio"
                    id={id}
                    name={o.name}
                    value={choice}
                    checked={selected}
                    onChange={() => {
                      setSelection((s) => ({ ...s, [o.name]: choice }));
                      setStatus('idle');
                    }}
                    className="visually-hidden"
                  />
                  <label htmlFor={id} className={canPick ? '' : 'is-unavailable'}>
                    {choice}
                    {!canPick && <span className="visually-hidden"> — out of stock</span>}
                  </label>
                </span>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="atc-row">
        <div className="field atc-qty">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={20}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          />
        </div>

        <button
          type="button"
          className="btn btn--primary atc-button"
          onClick={add}
          disabled={!available || status === 'adding'}
        >
          {!available ? 'Out of stock' : status === 'adding' ? 'Adding…' : 'Add to basket'}
        </button>
      </div>

      {!available && (
        <p className="atc-note muted">
          {options.length > 0
            ? 'That combination has sold out. Try another, or check back — we reprint regularly.'
            : 'This has sold out. We reprint regularly, so do check back.'}
        </p>
      )}

      <div role="status" aria-live="polite" className="atc-status">
        {status === 'added' && (
          <div className="alert alert--ok">
            {message} <a href="/cart">View basket</a>
          </div>
        )}
        {status === 'error' && <div className="alert alert--error">{message}</div>}
      </div>
    </div>
  );
}
