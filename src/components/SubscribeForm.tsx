import { useId, useRef, useState } from 'react';

type Status = 'idle' | 'sending' | 'ok' | 'duplicate' | 'error';

/**
 * Footer newsletter signup.
 *
 * Submits to /api/subscribe, which is the only thing that can write to the
 * Subscribers collection. All states render inline — no page reload, no alert
 * boxes. The status region is aria-live so a screen reader hears the result
 * without the focus moving.
 */
export default function SubscribeForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const uid = useId();
  const emailId = `${uid}-email`;
  const nameId = `${uid}-name`;
  const errId = `${uid}-err`;
  const hintId = `${uid}-hint`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const firstName = String(data.get('firstName') ?? '').trim();

    // Client-side check for speed; the server re-checks and is the real gate.
    if (!email) {
      setFieldError('Please enter your email address.');
      emailRef.current?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setFieldError('That does not look like an email address.');
      emailRef.current?.focus();
      return;
    }

    setFieldError('');
    setStatus('sending');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, firstName,
          website: String(data.get('website') ?? ''),
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (body.status === 'ok') {
        setStatus('ok');
        setMessage(body.message ?? "You're on the list. Thank you.");
        form.reset();
      } else if (body.status === 'duplicate') {
        setStatus('duplicate');
        setMessage(body.message ?? "You're already on the list.");
        form.reset();
      } else {
        setStatus('error');
        setMessage(body.message ?? 'Something went wrong. Please try again.');
        if (body.field === 'email') setFieldError(body.message ?? '');
      }
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Please check your connection and try again.');
    }
  }

  const done = status === 'ok' || status === 'duplicate';

  return (
    <form className="subscribe" onSubmit={onSubmit} noValidate>
      <p className="subscribe-copy" id={hintId}>
        A short email once a month: animals looking for homes, happy endings, and
        the odd appeal when we need something specific.
      </p>

      <div className="subscribe-fields">
        <div className="field">
          <label htmlFor={nameId}>First name <span className="muted">(optional)</span></label>
          <input id={nameId} name="firstName" type="text" autoComplete="given-name" />
        </div>

        <div className="field">
          <label htmlFor={emailId}>Email address <span className="req" aria-hidden="true">*</span></label>
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-required="true"
            aria-invalid={fieldError ? 'true' : undefined}
            aria-describedby={`${hintId}${fieldError ? ` ${errId}` : ''}`}
          />
          {fieldError && <span className="error-text" id={errId}>{fieldError}</span>}
        </div>

        <button className="btn btn--secondary" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Signing you up…' : 'Sign up'}
        </button>
      </div>

      {/* Hidden from people; bots fill it in and get a no-op success. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Leave this blank</label>
        <input id={`${uid}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div role="status" aria-live="polite" className="subscribe-status">
        {done && <span className="alert alert--ok">{message}</span>}
        {status === 'error' && <span className="alert alert--error">{message}</span>}
      </div>

      <p className="subscribe-privacy">
        We only email about the shelter, and you can unsubscribe any time.
        Read our <a href="/privacy">privacy policy</a>.
      </p>
    </form>
  );
}
