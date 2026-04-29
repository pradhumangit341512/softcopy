'use client';

/**
 * Daily Plan
 *
 * Two-column journal — Morning Commitment + Evening Achievements. Each side
 * has the same fields (online portal, WhatsApp post, emails worked,
 * buyers/sellers worked, meetings/visits, free-text note). Saving each side
 * is an idempotent upsert keyed on (user, date).
 *
 * Server-side gate: feature.daily_plan. Page also guards client-side via
 * useFeature() so the user gets an "upgrade required" empty-state instead
 * of a confusing 403.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { FeatureLocked } from '@/components/common/FeatureLocked';

interface DailyPlanHalf {
  onlinePortal?: boolean;
  whatsappPost?: boolean;
  emailsWorking?: number;
  buyersWorking?: number;
  sellersWorking?: number;
  meetingsVisits?: number;
  note?: string | null;
}

const EMPTY_HALF: DailyPlanHalf = {
  onlinePortal: false,
  whatsappPost: false,
  emailsWorking: 0,
  buyersWorking: 0,
  sellersWorking: 0,
  meetingsVisits: 0,
  note: '',
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DailyPlanPage() {
  const { isLoading: authLoading } = useAuth();
  const enabled = useFeature('feature.daily_plan');

  const [dateKey, setDateKey] = useState<string>(todayKey());
  const [morning, setMorning] = useState<DailyPlanHalf>(EMPTY_HALF);
  const [evening, setEvening] = useState<DailyPlanHalf>(EMPTY_HALF);
  const [loading, setLoading] = useState(true);
  const [savingHalf, setSavingHalf] = useState<'morning' | 'evening' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || authLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/daily-plan?date=${encodeURIComponent(dateKey)}`, { credentials: 'include' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load');
        return j as { plan: { morning: DailyPlanHalf | null; evening: DailyPlanHalf | null } | null };
      })
      .then((j) => {
        if (cancelled) return;
        const m = j.plan?.morning ?? null;
        const e = j.plan?.evening ?? null;
        setMorning(m ? { ...EMPTY_HALF, ...m } : EMPTY_HALF);
        setEvening(e ? { ...EMPTY_HALF, ...e } : EMPTY_HALF);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateKey, enabled, authLoading]);

  async function save(half: 'morning' | 'evening') {
    setSavingHalf(half);
    setError(null);
    setSuccess(null);
    try {
      const body =
        half === 'morning'
          ? { dateKey, morning }
          : { dateKey, evening };
      const res = await fetch('/api/daily-plan', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setSuccess(half === 'morning' ? 'Morning saved' : 'Evening saved');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingHalf(null);
    }
  }

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.daily_plan" />;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Today&apos;s Task</h1>
          <p className="text-sm text-gray-500">
            Log your daily commitments in the morning and your achievements in the evening.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <CalendarDays className="w-4 h-4 text-gray-500" aria-hidden />
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {loading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <DailyHalfCard
            title="Morning Commitment"
            accent="blue"
            value={morning}
            onChange={setMorning}
            onSave={() => save('morning')}
            saving={savingHalf === 'morning'}
            onClear={() => setMorning(EMPTY_HALF)}
          />
          <DailyHalfCard
            title="Evening Achievements"
            accent="emerald"
            value={evening}
            onChange={setEvening}
            onSave={() => save('evening')}
            saving={savingHalf === 'evening'}
            onClear={() => setEvening(EMPTY_HALF)}
          />
        </div>
      )}
    </div>
  );
}

function DailyHalfCard({
  title,
  accent,
  value,
  onChange,
  onSave,
  saving,
  onClear,
}: {
  title: string;
  accent: 'blue' | 'emerald';
  value: DailyPlanHalf;
  onChange: (next: DailyPlanHalf) => void;
  onSave: () => void;
  saving: boolean;
  onClear: () => void;
}) {
  const headerClass = accent === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200';
  const titleClass = accent === 'blue' ? 'text-blue-900' : 'text-emerald-900';

  function update<K extends keyof DailyPlanHalf>(k: K, v: DailyPlanHalf[K]) {
    onChange({ ...value, [k]: v });
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <header className={`px-4 py-3 border-b ${headerClass}`}>
        <h2 className={`font-semibold ${titleClass}`}>{title}</h2>
      </header>

      <div className="p-4 space-y-4">
        <YesNoRow
          label="Online Portal Checking"
          value={value.onlinePortal ?? false}
          onChange={(v) => update('onlinePortal', v)}
        />
        <YesNoRow
          label="WhatsApp Status / Post in Group"
          value={value.whatsappPost ?? false}
          onChange={(v) => update('whatsappPost', v)}
        />
        <NumberRow
          label="Emails Working on"
          value={value.emailsWorking ?? 0}
          onChange={(v) => update('emailsWorking', v)}
        />
        <NumberRow
          label="Buyers Working"
          value={value.buyersWorking ?? 0}
          onChange={(v) => update('buyersWorking', v)}
        />
        <NumberRow
          label="Sellers Working"
          value={value.sellersWorking ?? 0}
          onChange={(v) => update('sellersWorking', v)}
        />
        <NumberRow
          label="Meeting / Visits"
          value={value.meetingsVisits ?? 0}
          onChange={(v) => update('meetingsVisits', v)}
        />
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Add Note</span>
          <textarea
            value={value.note ?? ''}
            onChange={(e) => update('note', e.target.value)}
            placeholder="Anything else worth logging today…"
            rows={3}
            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </label>
      </div>

      <footer className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" aria-hidden />
          {saving ? 'Saving…' : 'Confirm'}
        </button>
      </footer>
    </section>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-3 py-1.5 ${value ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-3 py-1.5 border-l border-gray-200 ${!value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="number"
        min={0}
        max={999}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}
