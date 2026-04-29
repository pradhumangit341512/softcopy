/**
 * FeedbackSection — landing-page real-time feedback wall + submit form.
 *
 * Server-rendered list (initial HTML is fully indexable so AI overviews
 * and search crawlers can lift testimonials directly).
 *
 *   <FeedbackSection initialItems={…} initialSummary={…} />
 *
 * The list is fetched on the server in `app/page.tsx` so it ships in
 * the initial HTML. The submit form is a tiny client island that POSTs
 * and refreshes the list via router.refresh().
 *
 * Why server-render
 * ─────────────────
 *   AEO/GEO engines (Google AI Overview, ChatGPT browse, Perplexity)
 *   read the *initial HTML*, not what JavaScript hydrates afterwards.
 *   Putting reviews in the initial HTML is what makes them eligible
 *   for "what users say" answer cards.
 */

import { Star } from 'lucide-react';
import { FeedbackForm } from './FeedbackForm';

export interface FeedbackItem {
  id: string;
  name: string;
  role: string | null;
  rating: number;
  message: string;
  approvedAt: string | null;
}

export interface FeedbackSummary {
  count: number;
  averageRating: number | null;
}

interface Props {
  initialItems: FeedbackItem[];
  initialSummary: FeedbackSummary;
}

export function FeedbackSection({ initialItems, initialSummary }: Props) {
  return (
    <section
      id="feedback"
      aria-labelledby="feedback-heading"
      className="relative px-4 sm:px-6 py-16 sm:py-24 bg-gradient-to-b from-white to-gray-50"
    >
      <div className="max-w-6xl mx-auto">
        {/* Heading + summary */}
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 mb-3">
            Real customer feedback
          </p>
          <h2
            id="feedback-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-gray-900 tracking-tight"
          >
            What brokers say about Broker365
          </h2>
          {initialSummary.count > 0 && initialSummary.averageRating != null && (
            <p className="mt-4 text-sm text-gray-600 inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i < Math.round(initialSummary.averageRating ?? 0)
                        ? 'fill-amber-400 stroke-amber-400'
                        : 'fill-gray-200 stroke-gray-200'
                    }
                    aria-hidden
                  />
                ))}
              </span>
              <span className="text-gray-900 font-semibold">
                {initialSummary.averageRating.toFixed(2)}
              </span>
              <span className="text-gray-500">
                from {initialSummary.count} review{initialSummary.count === 1 ? '' : 's'}
              </span>
            </p>
          )}
        </div>

        {/* Wall of approved feedback */}
        {initialItems.length === 0 ? (
          <div className="text-center text-sm text-gray-500 max-w-md mx-auto mb-10">
            Be the first to leave feedback — your review will show here once approved.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-14">
            {initialItems.map((f) => (
              <li
                key={f.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col"
              >
                <div className="flex items-center gap-1 mb-3" aria-label={`${f.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={
                        i < f.rating
                          ? 'fill-amber-400 stroke-amber-400'
                          : 'fill-gray-200 stroke-gray-200'
                      }
                      aria-hidden
                    />
                  ))}
                </div>
                <blockquote className="text-sm sm:text-base text-gray-700 leading-relaxed flex-1 whitespace-pre-line">
                  “{f.message}”
                </blockquote>
                <footer className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                  {f.role && <p className="text-xs text-gray-500">{f.role}</p>}
                </footer>
              </li>
            ))}
          </ul>
        )}

        {/* Submit form */}
        <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-5 sm:p-7 shadow-sm">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
            Share your feedback
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Anyone can submit. We&apos;ll review and publish here. No login required.
          </p>
          <FeedbackForm />
        </div>
      </div>
    </section>
  );
}
