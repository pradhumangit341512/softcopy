'use client';

/**
 * Onboarding enquiry form for the landing page.
 *
 * Replaces the old client-side mailto: flow — which silently dropped leads
 * any time the visitor didn't have a mail client configured — with a real
 * POST to /api/onboarding-enquiry that persists the row in the DB and
 * emails the admin inbox as a second channel.
 *
 * Accessibility:
 *   - `aria-invalid` + `aria-describedby` point at the active error so
 *     screen readers announce which field is wrong, not just that "there
 *     is an error."
 *   - Honeypot is positioned off-screen AND marked `aria-hidden`.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  teamSize: string;
  plan: string;
  message: string;
  consent: boolean;
  hp: string; // must stay empty — bots fill it
}

const EMPTY_FORM: FormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  city: '',
  teamSize: '',
  plan: '',
  message: '',
  consent: false,
  hp: '',
};

export function OnboardingForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [errorField, setErrorField] = useState<keyof FormState | null>(null);

  // Guards against the old "setTimeout fires after unmount" warning — no
  // state updates once the component has been torn down.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errorField === key) {
      setErrorField(null);
      setFormError('');
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Silent success for honeypot hits — bot thinks it worked, nothing
    // reaches the DB or inbox.
    if (form.hp.length > 0) {
      setSubmitted(true);
      return;
    }

    if (!form.name.trim()) {
      setErrorField('name');
      setFormError('Please enter your full name.');
      return;
    }
    if (!form.company.trim()) {
      setErrorField('company');
      setFormError('Please enter your brokerage or company name.');
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorField('email');
      setFormError("That email doesn't look right — please check it.");
      return;
    }
    if (!form.consent) {
      setErrorField('consent');
      setFormError('Please tick the consent box so we can contact you.');
      return;
    }

    setErrorField(null);
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/onboarding-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name.trim(),
          company:  form.company.trim(),
          email:    form.email.trim(),
          phone:    form.phone.trim() || null,
          city:     form.city.trim() || null,
          teamSize: form.teamSize || null,
          plan:     form.plan || null,
          message:  form.message.trim() || null,
          consent:  true,
          hp:       form.hp,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ||
            'We could not record your enquiry right now. Please email hello@broker365.in instead.'
        );
      }

      if (aliveRef.current) setSubmitted(true);
    } catch (err) {
      if (!aliveRef.current) return;
      setFormError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="form-success" role="status" aria-live="polite">
        <span className="form-success__mark" aria-hidden>✓</span>
        <h3>Thank you, {form.name.split(' ')[0] || 'friend'}.</h3>
        <p>
          Your enquiry is in. We&rsquo;ll reach out from{' '}
          <a href="mailto:hello@broker365.in">hello@broker365.in</a> within 24 hours to
          schedule your walkthrough.
        </p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setSubmitted(false);
            setForm(EMPTY_FORM);
            setFormError('');
            setErrorField(null);
          }}
        >
          Submit another enquiry
        </button>
      </div>
    );
  }

  return (
    <form
      className="form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Broker365 onboarding enquiry"
    >
      <div className="form__head">
        <span className="form__label">Onboarding enquiry</span>
        <span className="form__meta">Takes ~60 seconds</span>
      </div>

      <div className="form__row">
        <div className="field">
          <label htmlFor="f-name">Full name *</label>
          <input
            id="f-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Raj Kapoor"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            aria-invalid={errorField === 'name' || undefined}
            aria-describedby={errorField === 'name' ? 'f-error' : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="f-company">Brokerage / company *</label>
          <input
            id="f-company"
            name="company"
            type="text"
            autoComplete="organization"
            placeholder="Pillai & Co"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            required
            aria-invalid={errorField === 'company' || undefined}
            aria-describedby={errorField === 'company' ? 'f-error' : undefined}
          />
        </div>
      </div>

      <div className="form__row">
        <div className="field">
          <label htmlFor="f-email">Work email *</label>
          <input
            id="f-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@brokerage.com"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
            aria-invalid={errorField === 'email' || undefined}
            aria-describedby={errorField === 'email' ? 'f-error' : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="f-phone">Phone</label>
          <input
            id="f-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
        </div>
      </div>

      <div className="form__row">
        <div className="field">
          <label htmlFor="f-city">City</label>
          <input
            id="f-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            placeholder="Bengaluru"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="f-team">Team size</label>
          <select
            id="f-team"
            name="teamSize"
            value={form.teamSize}
            onChange={(e) => handleChange('teamSize', e.target.value)}
          >
            <option value="">Select…</option>
            <option value="1">Just me</option>
            <option value="2-5">2–5 agents</option>
            <option value="6-15">6–15 agents</option>
            <option value="16+">16+ agents</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-plan">Interested plan</label>
        <select
          id="f-plan"
          name="plan"
          value={form.plan}
          onChange={(e) => handleChange('plan', e.target.value)}
        >
          <option value="">Not sure yet</option>
          <option value="Solo">Solo — ₹999/mo</option>
          <option value="Team">Team — ₹2,999/mo</option>
          <option value="Enterprise">Enterprise — Custom</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-msg">What are you trying to solve?</label>
        <textarea
          id="f-msg"
          name="message"
          rows={4}
          placeholder="We&rsquo;re losing leads in WhatsApp threads and need one dashboard the whole team can use…"
          value={form.message}
          onChange={(e) => handleChange('message', e.target.value)}
        />
      </div>

      {/* Honeypot — kept off-screen + aria-hidden so humans never see it. */}
      <input
        type="text"
        name="website"
        value={form.hp}
        onChange={(e) => handleChange('hp', e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="form__hp"
        aria-hidden
      />

      <label className="consent">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => handleChange('consent', e.target.checked)}
          required
          aria-invalid={errorField === 'consent' || undefined}
          aria-describedby={errorField === 'consent' ? 'f-error' : undefined}
        />
        <span>
          I agree to be contacted by Broker365 about onboarding. We don&rsquo;t share
          your details.
        </span>
      </label>

      {formError && (
        <p id="f-error" className="form__error" role="alert">{formError}</p>
      )}

      <button
        type="submit"
        className="btn btn--primary btn--lg form__submit"
        disabled={submitting}
      >
        {submitting ? 'Sending…' : 'Request onboarding'}{' '}
        {!submitting && <span aria-hidden>→</span>}
      </button>

      <p className="form__fine">
        Members-only access · Every sign-in is OTP-verified
      </p>
    </form>
  );
}
