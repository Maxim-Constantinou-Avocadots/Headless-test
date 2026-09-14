import { useId, useRef, useState } from 'react';

type Errors = Record<string, string>;

/** General contact form. Posts to /api/enquiry, which is the only writer. */
export default function EnquiryForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const statusRef = useRef<HTMLDivElement>(null);

  const uid = useId();
  const ids = {
    name: `${uid}-name`, email: `${uid}-email`,
    subject: `${uid}-subject`, message: `${uid}-message`,
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const values = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      subject: String(data.get('subject') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
      website: String(data.get('website') ?? ''),
    };

    const next: Errors = {};
    if (!values.name) next.name = 'Please tell us your name.';
    if (!values.email) next.email = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) {
      next.email = 'That does not look like an email address.';
    }
    if (!values.message) next.message = 'Please tell us how we can help.';

    if (Object.keys(next).length) {
      setErrors(next);
      document.getElementById(ids[Object.keys(next)[0] as keyof typeof ids])?.focus();
      return;
    }

    setErrors({});
    setStatus('sending');

    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));

      if (body.status === 'ok') {
        setStatus('ok');
        setMessage(body.message ?? 'Thank you — we will be in touch.');
        form.reset();
      } else if (body.status === 'invalid') {
        setStatus('idle');
        setErrors(body.errors ?? {});
      } else {
        setStatus('error');
        setMessage(body.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Please try again.');
    }
  }

  const field = (
    name: keyof typeof ids,
    label: string,
    type: string,
    required: boolean,
    autoComplete?: string,
  ) => (
    <div className="field">
      <label htmlFor={ids[name]}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      <input
        id={ids[name]} name={name} type={type} required={required}
        aria-required={required || undefined}
        autoComplete={autoComplete}
        aria-invalid={errors[name] ? 'true' : undefined}
        aria-describedby={errors[name] ? `${ids[name]}-err` : undefined}
      />
      {errors[name] && <span className="error-text" id={`${ids[name]}-err`}>{errors[name]}</span>}
    </div>
  );

  return (
    <form className="enquiry" onSubmit={onSubmit} noValidate>
      {field('name', 'Your name', 'text', true, 'name')}
      {field('email', 'Email address', 'email', true, 'email')}
      {field('subject', 'Subject', 'text', false)}

      <div className="field">
        <label htmlFor={ids.message}>
          Message <span className="req" aria-hidden="true">*</span>
        </label>
        <textarea
          id={ids.message} name="message" required aria-required="true"
          aria-invalid={errors.message ? 'true' : undefined}
          aria-describedby={errors.message ? `${ids.message}-err` : undefined}
        />
        {errors.message && <span className="error-text" id={`${ids.message}-err`}>{errors.message}</span>}
      </div>

      <div className="hp" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Leave this blank</label>
        <input id={`${uid}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button className="btn btn--primary" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>

      <div role="status" aria-live="polite" className="enquiry-status" ref={statusRef}>
        {status === 'ok' && <p className="alert alert--ok">{message}</p>}
        {status === 'error' && <p className="alert alert--error">{message}</p>}
      </div>

      <p className="hint enquiry-privacy">
        We use your message only to reply to you. See our{' '}
        <a href="/privacy">privacy policy</a>.
      </p>
    </form>
  );
}
