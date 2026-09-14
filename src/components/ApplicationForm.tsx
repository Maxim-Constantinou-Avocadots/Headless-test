import { useEffect, useMemo, useRef, useState } from 'react';

export interface AnimalOption {
  id: string;
  slug: string;
  name: string;
  breed: string;
  status: string;
}

interface Props {
  animals: AnimalOption[];
  /** Slug from ?animal=…, when the applicant came from an animal page. */
  preselectedSlug?: string;
  responseDays: string;
}

type Values = Record<string, string | boolean>;
type Errors = Record<string, string>;

const STEPS = [
  { id: 'animal',     title: 'About the animal' },
  { id: 'you',        title: 'About you' },
  { id: 'home',       title: 'Your home' },
  { id: 'experience', title: 'Your experience with pets' },
  { id: 'agree',      title: 'Agreements' },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d][\d\s()-]{7,19}$/;

const INITIAL: Values = {
  animalId: '', whyThisAnimal: '',
  firstName: '', lastName: '', email: '', phone: '',
  addressLine1: '', city: '', postalCode: '', country: 'United Kingdom',
  over18: false,
  homeType: '', ownOrRent: '', landlordPermission: false, hasGarden: false,
  householdAdults: '1', householdChildren: '0', childrenAges: '',
  otherPets: '', previousPets: '', hoursAloneDaily: '', vetName: '',
  agreeHomeCheck: false, agreeTerms: false,
  website: '',
};

/**
 * Multi-step adoption application.
 *
 * Every step lives in the same form and stays mounted, so going back and
 * forth never loses what someone has typed. Each step is validated before
 * moving on, and the whole thing is validated again on the server — which is
 * the copy that actually decides whether anything is written.
 */
export default function ApplicationForm({ animals, preselectedSlug, responseDays }: Props) {
  const preselected = useMemo(
    () => animals.find((a) => a.slug === preselectedSlug),
    [animals, preselectedSlug],
  );

  const [values, setValues] = useState<Values>(() => ({
    ...INITIAL,
    animalId: preselected?.id ?? '',
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users
  // are not left at the bottom of the previous step.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const set = (name: string, value: string | boolean) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: '' } : e));
  };

  const renting = values.ownOrRent === 'Rent';
  const hasChildren = Number(values.householdChildren) > 0;

  function validateStep(index: number): Errors {
    const e: Errors = {};
    const s = (k: string) => String(values[k] ?? '').trim();

    if (index === 0) {
      if (!s('animalId')) e.animalId = 'Please choose which animal you are applying for.';
      if (!s('whyThisAnimal')) e.whyThisAnimal = 'Please tell us a little about why this animal.';
    }

    if (index === 1) {
      if (!s('firstName')) e.firstName = 'Please enter your first name.';
      if (!s('lastName')) e.lastName = 'Please enter your last name.';
      if (!s('email')) e.email = 'Please enter your email address.';
      else if (!EMAIL_RE.test(s('email'))) e.email = 'That does not look like an email address.';
      if (!s('phone')) e.phone = 'Please enter a phone number.';
      else if (!PHONE_RE.test(s('phone'))) e.phone = 'Please enter a phone number we can reach you on.';
      if (!s('addressLine1')) e.addressLine1 = 'Please enter your address.';
      if (!s('city')) e.city = 'Please enter your town or city.';
      if (!s('postalCode')) e.postalCode = 'Please enter your postcode.';
      if (!values.over18) e.over18 = 'We can only rehome to adults over 18.';
    }

    if (index === 2) {
      if (!s('homeType')) e.homeType = 'Please tell us what kind of home you have.';
      if (!s('ownOrRent')) e.ownOrRent = 'Please tell us whether you own or rent.';
      if (values.ownOrRent === 'Rent' && !values.landlordPermission) {
        e.landlordPermission = 'We need confirmation that your landlord allows pets.';
      }
      const adults = Number(values.householdAdults);
      if (!Number.isFinite(adults) || adults < 1) e.householdAdults = 'Please enter at least 1.';
      const children = Number(values.householdChildren);
      if (!Number.isFinite(children) || children < 0) e.householdChildren = 'Please enter 0 if there are no children.';
      if (children > 0 && !s('childrenAges')) {
        e.childrenAges = 'Please tell us the ages of the children at home.';
      }
    }

    if (index === 3) {
      const hours = Number(values.hoursAloneDaily);
      if (s('hoursAloneDaily') === '') e.hoursAloneDaily = 'Please tell us roughly how long the animal would be alone.';
      else if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
        e.hoursAloneDaily = 'Please enter a number of hours between 0 and 24.';
      }
    }

    if (index === 4) {
      if (!values.agreeHomeCheck) e.agreeHomeCheck = 'We home-check every adopter, so this one is required.';
      if (!values.agreeTerms) e.agreeTerms = 'Please accept the adoption terms.';
    }

    return e;
  }

  function focusErrors(e: Errors) {
    setErrors(e);
    // A summary is easier to act on than a scatter of inline messages.
    window.requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function next() {
    const e = validateStep(step);
    if (Object.keys(e).length) { focusErrors(e); return; }
    setErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    // Re-check every step, not just the last — someone can reach the end with
    // an earlier field cleared.
    let all: Errors = {};
    for (let i = 0; i < STEPS.length; i++) all = { ...all, ...validateStep(i) };

    if (Object.keys(all).length) {
      const firstBad = STEPS.findIndex((_, i) => Object.keys(validateStep(i)).length > 0);
      setStep(firstBad < 0 ? 0 : firstBad);
      focusErrors(all);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));

      if (body.status === 'ok' && body.redirect) {
        window.location.href = body.redirect;
        return;
      }
      if (body.status === 'invalid' && body.errors) {
        const serverErrors = body.errors as Errors;
        const firstBad = STEPS.findIndex((_, i) =>
          Object.keys(validateStep(i)).some((k) => k in serverErrors));
        setStep(firstBad < 0 ? 0 : firstBad);
        focusErrors(serverErrors);
        setFormError('Please check the highlighted answers.');
      } else {
        setFormError(body.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setFormError('We could not reach the server. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const errorList = Object.entries(errors).filter(([, v]) => v);
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  const text = (name: string, label: string, opts: {
    type?: string; required?: boolean; autoComplete?: string; hint?: string; inputMode?: 'numeric';
    min?: number; max?: number;
  } = {}) => (
    <div className="field">
      <label htmlFor={name}>
        {label} {opts.required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {opts.hint && <span className="hint" id={`${name}-hint`}>{opts.hint}</span>}
      <input
        id={name}
        name={name}
        type={opts.type ?? 'text'}
        value={String(values[name] ?? '')}
        onChange={(e) => set(name, e.target.value)}
        required={opts.required}
        aria-required={opts.required || undefined}
        autoComplete={opts.autoComplete}
        inputMode={opts.inputMode}
        min={opts.min}
        max={opts.max}
        aria-invalid={errors[name] ? 'true' : undefined}
        aria-describedby={[opts.hint ? `${name}-hint` : '', errors[name] ? `${name}-err` : '']
          .filter(Boolean).join(' ') || undefined}
      />
      {errors[name] && <span className="error-text" id={`${name}-err`}>{errors[name]}</span>}
    </div>
  );

  const textarea = (name: string, label: string, required: boolean, hint?: string) => (
    <div className="field">
      <label htmlFor={name}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {hint && <span className="hint" id={`${name}-hint`}>{hint}</span>}
      <textarea
        id={name}
        name={name}
        value={String(values[name] ?? '')}
        onChange={(e) => set(name, e.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={errors[name] ? 'true' : undefined}
        aria-describedby={[hint ? `${name}-hint` : '', errors[name] ? `${name}-err` : '']
          .filter(Boolean).join(' ') || undefined}
      />
      {errors[name] && <span className="error-text" id={`${name}-err`}>{errors[name]}</span>}
    </div>
  );

  const select = (name: string, label: string, options: string[], required: boolean) => (
    <div className="field">
      <label htmlFor={name}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={String(values[name] ?? '')}
        onChange={(e) => set(name, e.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={errors[name] ? 'true' : undefined}
        aria-describedby={errors[name] ? `${name}-err` : undefined}
      >
        <option value="">Please choose…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {errors[name] && <span className="error-text" id={`${name}-err`}>{errors[name]}</span>}
    </div>
  );

  const checkbox = (name: string, label: string) => (
    <div className="check">
      <input
        id={name}
        name={name}
        type="checkbox"
        checked={Boolean(values[name])}
        onChange={(e) => set(name, e.target.checked)}
        aria-invalid={errors[name] ? 'true' : undefined}
        aria-describedby={errors[name] ? `${name}-err` : undefined}
      />
      <div>
        <label htmlFor={name}>{label}</label>
        {errors[name] && <span className="error-text" id={`${name}-err`}>{errors[name]}</span>}
      </div>
    </div>
  );

  return (
    <form className="application" onSubmit={onSubmit} noValidate>
      <div className="app-progress">
        <div className="app-progress-bar">
          <div className="app-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="app-progress-text">
          Step {step + 1} of {STEPS.length}: <strong>{STEPS[step].title}</strong>
        </p>
        <ol className="app-steps">
          {STEPS.map((s, i) => (
            <li key={s.id} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
              <span className="visually-hidden">
                {i < step ? 'Completed: ' : i === step ? 'Current step: ' : 'Not yet reached: '}
              </span>
              {s.title}
            </li>
          ))}
        </ol>
      </div>

      <div
        ref={summaryRef}
        tabIndex={-1}
        role={errorList.length ? 'alert' : undefined}
        className="app-summary"
      >
        {errorList.length > 0 && (
          <div className="alert alert--error">
            <p><strong>Please check {errorList.length === 1 ? 'this answer' : 'these answers'}:</strong></p>
            <ul>
              {errorList.map(([k, v]) => (
                <li key={k}><a href={`#${k}`} onClick={() => document.getElementById(k)?.focus()}>{v}</a></li>
              ))}
            </ul>
          </div>
        )}
        {formError && !errorList.length && <p className="alert alert--error">{formError}</p>}
      </div>

      {/* Every step stays mounted so nothing typed is lost when going back. */}
      <fieldset hidden={step !== 0}>
        <legend className="visually-hidden">About the animal</legend>
        <h2 ref={step === 0 ? headingRef : undefined} tabIndex={-1} className="app-heading">
          About the animal
        </h2>

        {preselected ? (
          <div className="chosen-animal">
            <p className="kicker">You are applying for</p>
            <p className="chosen-name">{preselected.name}</p>
            <p className="muted">{preselected.breed}</p>
            <input type="hidden" name="animalId" value={preselected.id} />
            <p className="chosen-change">
              <a href="/adopt">Choose a different animal</a>
            </p>
          </div>
        ) : animals.length === 0 ? (
          <p className="alert alert--warn">
            We could not load the list of animals. Please ring the shelter and we
            will take your application over the phone.
          </p>
        ) : (
          <div className="field">
            <label htmlFor="animalId">
              Which animal are you applying for? <span className="req" aria-hidden="true">*</span>
            </label>
            <select
              id="animalId"
              name="animalId"
              value={String(values.animalId ?? '')}
              onChange={(e) => set('animalId', e.target.value)}
              required
              aria-required="true"
              aria-invalid={errors.animalId ? 'true' : undefined}
              aria-describedby={errors.animalId ? 'animalId-err' : undefined}
            >
              <option value="">Please choose…</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.breed}{a.status === 'Pending' ? ' (application pending)' : ''}
                </option>
              ))}
            </select>
            {errors.animalId && <span className="error-text" id="animalId-err">{errors.animalId}</span>}
          </div>
        )}

        {textarea('whyThisAnimal', 'What drew you to this animal?', true,
          'A few sentences is plenty. We are not looking for a perfect answer — it just helps us picture the match.')}
      </fieldset>

      <fieldset hidden={step !== 1}>
        <legend className="visually-hidden">About you</legend>
        <h2 ref={step === 1 ? headingRef : undefined} tabIndex={-1} className="app-heading">About you</h2>

        <div className="field-row">
          {text('firstName', 'First name', { required: true, autoComplete: 'given-name' })}
          {text('lastName', 'Last name', { required: true, autoComplete: 'family-name' })}
        </div>
        <div className="field-row">
          {text('email', 'Email address', { required: true, type: 'email', autoComplete: 'email' })}
          {text('phone', 'Phone number', { required: true, type: 'tel', autoComplete: 'tel' })}
        </div>
        {text('addressLine1', 'Address', { required: true, autoComplete: 'address-line1' })}
        <div className="field-row">
          {text('city', 'Town or city', { required: true, autoComplete: 'address-level2' })}
          {text('postalCode', 'Postcode', { required: true, autoComplete: 'postal-code' })}
        </div>
        {text('country', 'Country', { autoComplete: 'country-name' })}

        {checkbox('over18', 'I am over 18 years old')}
      </fieldset>

      <fieldset hidden={step !== 2}>
        <legend className="visually-hidden">Your home</legend>
        <h2 ref={step === 2 ? headingRef : undefined} tabIndex={-1} className="app-heading">Your home</h2>

        {select('homeType', 'What kind of home do you have?', ['House', 'Apartment', 'Other'], true)}
        {select('ownOrRent', 'Do you own or rent?', ['Own', 'Rent'], true)}

        {/* Revealed only for renters, and required once shown. */}
        {renting && (
          <div className="conditional">
            {checkbox('landlordPermission', 'My landlord permits pets at this address')}
            <p className="hint">
              We will ask to see this in writing before the adoption is completed.
            </p>
          </div>
        )}

        {checkbox('hasGarden', 'I have a garden or private outdoor space')}

        <div className="field-row">
          {text('householdAdults', 'Adults in the household', { required: true, type: 'number', inputMode: 'numeric', min: 1 })}
          {text('householdChildren', 'Children in the household', { required: true, type: 'number', inputMode: 'numeric', min: 0 })}
        </div>

        {/* Revealed only when there are children. */}
        {hasChildren && (
          <div className="conditional">
            {text('childrenAges', "Children's ages", { required: true, hint: 'For example: 4, 7 and 12' })}
          </div>
        )}
      </fieldset>

      <fieldset hidden={step !== 3}>
        <legend className="visually-hidden">Your experience with pets</legend>
        <h2 ref={step === 3 ? headingRef : undefined} tabIndex={-1} className="app-heading">
          Your experience with pets
        </h2>

        {textarea('otherPets', 'What other pets live with you now?', false,
          'Species, rough age, and whether they are neutered. Write "none" if there are none.')}
        {textarea('previousPets', 'Tell us about pets you have had before', false,
          'Including what happened to them. We ask everyone, and there is no wrong answer.')}
        {text('hoursAloneDaily', 'On a typical weekday, how many hours would the animal be alone?', {
          required: true, type: 'number', inputMode: 'numeric', min: 0, max: 24,
        })}
        {text('vetName', 'Your vet practice, if you have one', { hint: 'Optional' })}
      </fieldset>

      <fieldset hidden={step !== 4}>
        <legend className="visually-hidden">Agreements</legend>
        <h2 ref={step === 4 ? headingRef : undefined} tabIndex={-1} className="app-heading">Agreements</h2>

        <p className="muted">
          Two last things. Both are required — they are how we make sure an
          animal only moves once.
        </p>

        {checkbox('agreeHomeCheck', 'I agree to a home visit before the adoption is completed')}
        {checkbox('agreeTerms',
          'I have read and accept the adoption terms, and understand the fee is non-refundable')}

        <p className="hint privacy-note">
          We use your answers only to assess this application and will never
          share them. See our <a href="/privacy">privacy policy</a>.
        </p>
      </fieldset>

      {/* Hidden from people; bots fill it in and the submission is discarded. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Leave this blank</label>
        <input
          id="website" name="website" type="text" tabIndex={-1} autoComplete="off"
          value={String(values.website ?? '')}
          onChange={(e) => set('website', e.target.value)}
        />
      </div>

      <div className="app-actions">
        {step > 0 && (
          <button type="button" className="btn btn--ghost" onClick={back}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={next}>
            Continue
          </button>
        ) : (
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Sending your application…' : 'Send application'}
          </button>
        )}
      </div>

      <p className="app-footnote muted">
        We read every application ourselves and reply within {responseDays}.
      </p>
    </form>
  );
}
