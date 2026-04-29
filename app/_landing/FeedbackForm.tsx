'use client';

/**
 * FeedbackForm — public submit form on the landing page.
 *
 * Posts to /api/feedback. Submission lands as `pending`; superadmin
 * approves before it surfaces in the wall above. Includes:
 *
 *   - 1–5 star rating picker (keyboard accessible)
 *   - Honeypot field hidden from real users (bots fill every input)
 *   - 20–600 char message bound matched to the server schema
 *   - Defensive JSON parsing so a server crash shows a real error
 *
 * After a successful submit, the user sees a thank-you state. The list
 * itself is server-rendered and updates on next page load — we
 * deliberately don't refresh in place because pending rows aren't shown
 * until approval anyway.
 */

import { useState, type FormEvent } from 'react';
import { Star } from 'lucide-react';

export function FeedbackForm() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  /** Honeypot — hidden from real users; bots tend to autofill every input */
  const [website, setWebsite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setDone(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim() || null,
          rating,
          message: message.trim(),
          email: email.trim() || '',
          source: 'landing',
          website, // honeypot — server treats non-empty as silent reject
        }),
      });
      const j = await res.json().catch(() => ({} as { error?: string; message?: string }));
      if (!res.ok) {
        throw new Error(
          (j as { error?: string }).error ?? `Failed (HTTP ${res.status})`
        );
      }
      setDone(
        (j as { message?: string }).message ??
          'Thanks — your feedback has been received.'
      );
      // Reset visible fields. Don't reset the honeypot — bots that
      // autofilled it stay flagged on subsequent attempts.
      setName('');
      setRole('');
      setMessage('');
      setEmail('');
      setRating(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {done}
        <button
          type="button"
          onClick={() => setDone(null)}
          className="ml-2 underline font-semibold"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Your name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-800">Role / Company</span>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={120}
            placeholder="Director, Mehta Realty"
            className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-800">Rating</legend>
        <div className="flex items-center gap-1.5 mt-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              aria-pressed={rating === n}
              className="p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Star
                size={22}
                className={
                  n <= rating
                    ? 'fill-amber-400 stroke-amber-400'
                    : 'fill-gray-200 stroke-gray-300 hover:fill-amber-200 hover:stroke-amber-300 transition-colors'
                }
                aria-hidden
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-600">{rating} / 5</span>
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-gray-800">Message *</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={20}
          maxLength={600}
          rows={4}
          placeholder="What did you find useful? Anything we can improve?"
          className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <span className="text-xs text-gray-400 mt-0.5 block">
          {message.length} / 600
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-800">Email (optional)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="we won&apos;t publish this"
          className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>

      {/* Honeypot. Real humans never see or fill this. Position absolute
          + aria-hidden so screen readers skip it; tabIndex={-1} so
          keyboard nav doesn't land on it either. */}
      <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting || message.trim().length < 20 || name.trim().length < 2}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit feedback'}
      </button>
    </form>
  );
}
