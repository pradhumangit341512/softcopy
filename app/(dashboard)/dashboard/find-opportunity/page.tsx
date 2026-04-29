'use client';

/**
 * Find Opportunity — F19
 *
 * Shows ranked buyer↔inventory matches with explainable reasons. Each
 * match card pairs the lead with the suggested property and lists the
 * scoring factors so a salesperson can act with context.
 *
 * Server-side gate: feature.opportunity_matcher.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Phone, IndianRupee } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import type { Client, Property } from '@/lib/types';

interface MatchReason {
  label: string;
  weight: number;
}
interface MatchResult {
  client: Client;
  property: Property;
  score: number;
  reasons: MatchReason[];
}
interface ApiResponse {
  matches: MatchResult[];
  counts: {
    clientsScanned: number;
    propertiesScanned: number;
    clientsCapped: boolean;
    propertiesCapped: boolean;
  };
}

const fmt = (n: number | undefined | null) =>
  n == null ? '—' : `₹${(n).toLocaleString('en-IN')}`;

export default function FindOpportunityPage() {
  const { isLoading: authLoading } = useAuth();
  const enabled = useFeature('feature.opportunity_matcher');

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !enabled) return;
    let cancelled = false;
    // Wrapping the fetch in an async function keeps every setState call
    // inside an async callback — synchronously calling setState at the
    // top of the effect body would trigger react-hooks/set-state-in-effect.
    async function run() {
      try {
        const res = await fetch('/api/find-opportunity', { credentials: 'include' });
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(j.error || 'Failed to fetch matches');
        setData(j as ApiResponse);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to fetch matches');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [authLoading, enabled]);

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.opportunity_matcher" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
          <Sparkles size={20} className="text-violet-500" />
          Find Opportunity
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
          Auto-matched buyer leads with inventory by location, BHK, budget, and intent.
        </p>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading ? (
        <Loader message="Scoring matches…" />
      ) : !data || data.matches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-sm text-gray-400">
          <Sparkles size={28} className="mx-auto text-gray-300 mb-2" />
          <p>No high-confidence matches right now.</p>
          <p className="mt-1">
            Add more leads with budget + location, or capture inventory with project / sector
            details (Pro plan unlocks structured fields).
          </p>
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-400">
            {data.matches.length} matches · scanned {data.counts.clientsScanned} leads ×{' '}
            {data.counts.propertiesScanned} inventory rows
            {(data.counts.clientsCapped || data.counts.propertiesCapped) && (
              <span className="ml-2 text-amber-600">(capped — refine filters)</span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {data.matches.map((m, idx) => (
              <MatchCard key={`${m.client.id}-${m.property.id}-${idx}`} match={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: MatchResult }) {
  const c = match.client;
  const p = match.property;
  const scoreColor =
    match.score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : match.score >= 60 ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${scoreColor}`}>
          {match.score}% match
        </span>
        <div className="flex flex-wrap gap-1">
          {match.reasons.slice(0, 4).map((r, i) => (
            <span
              key={i}
              title={`+${r.weight} pts`}
              className="text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full"
            >
              {r.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        {/* Lead side */}
        <Link
          href={`/dashboard/all-leads/${c.id}`}
          className="block rounded-xl border border-gray-100 p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Lead</p>
          <p className="font-semibold text-gray-900 mt-0.5">{c.clientName}</p>
          {c.phone && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Phone size={10} /> {c.phone}
            </p>
          )}
          <div className="mt-2 space-y-0.5 text-xs text-gray-600">
            <p>{c.requirementType ?? '—'} · {c.inquiryType ?? '—'}</p>
            {c.preferredLocation && <p className="truncate">📍 {c.preferredLocation}</p>}
            {c.budget != null && (
              <p className="flex items-center gap-1">
                <IndianRupee size={10} /> {fmt(c.budget)}
              </p>
            )}
          </div>
        </Link>

        <div className="hidden sm:flex items-center justify-center text-gray-300">
          <ArrowRight size={20} />
        </div>

        {/* Inventory side */}
        <Link
          href={`/dashboard/inventory/${p.id}`}
          className="block rounded-xl border border-gray-100 p-3 hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Inventory</p>
          <p className="font-semibold text-gray-900 mt-0.5">{p.propertyName}</p>
          <div className="mt-2 space-y-0.5 text-xs text-gray-600">
            {(p.projectName || p.sectorNo) && (
              <p className="truncate">
                {p.projectName}
                {p.projectName && p.sectorNo && ' · '}
                {p.sectorNo}
              </p>
            )}
            <p>
              {p.bhkType ?? p.typology ?? '—'} · {p.area ?? '—'}
            </p>
            <p className="flex items-center gap-1">
              <IndianRupee size={10} /> {fmt(p.sellingPrice ?? p.askingRent)}
            </p>
          </div>
        </Link>
      </div>
    </article>
  );
}
