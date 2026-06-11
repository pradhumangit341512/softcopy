'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, ChevronLeft, ChevronRight, ArrowLeft, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { OfficeLocationsModal } from '@/components/payroll/OfficeLocationsModal';
import {
  ATTENDANCE_STATUSES, ATTENDANCE_CYCLE, getAttendanceStatus, absentUnitsFor,
} from '@/lib/attendance';

interface Member { id: string; name: string; email: string }
interface Att { userId: string; date: string; status: string; note?: string | null }

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function currentPeriod(): string {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 7);
}
function istTodayStr(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextStatus(current: string | undefined): string | null {
  if (!current) return ATTENDANCE_CYCLE[0];
  const i = ATTENDANCE_CYCLE.indexOf(current);
  if (i === -1) return ATTENDANCE_CYCLE[0];
  return i + 1 < ATTENDANCE_CYCLE.length ? ATTENDANCE_CYCLE[i + 1] : null; // past last → clear
}

/** Admin monthly attendance grid (manual marking). Click a cell to cycle status. */
export default function AttendancePage() {
  const { user, isLoading: authLoading } = useAuth();
  const canPayroll = useFeature('feature.payroll');
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [period, setPeriod] = useState(currentPeriod());
  const [members, setMembers] = useState<Member[]>([]);
  const [map, setMap] = useState<Record<string, string>>({}); // `${userId}_${date}` → status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoOpen, setGeoOpen] = useState(false);

  const today = istTodayStr();
  const [year, month] = period.split('-').map(Number);
  const days = useMemo(() => {
    const count = new Date(year, month, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const date = `${period}-${String(d).padStart(2, '0')}`;
      return { d, date, weekday: new Date(year, month - 1, d).getDay() };
    });
  }, [period, year, month]);

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    [year, month]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/attendance?period=${period}`, { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load attendance');
      setMembers(j.members ?? []);
      const next: Record<string, string> = {};
      for (const a of (j.attendance ?? []) as Att[]) next[`${a.userId}_${a.date}`] = a.status;
      setMap(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdmin || !canPayroll) return;
    fetchData();
  }, [authLoading, user?.id, isAdmin, canPayroll, fetchData]);

  async function cycleCell(userId: string, date: string) {
    const key = `${userId}_${date}`;
    const target = nextStatus(map[key]);
    // optimistic update
    setMap((prev) => {
      const copy = { ...prev };
      if (target) copy[key] = target; else delete copy[key];
      return copy;
    });
    try {
      const res = await fetch('/api/payroll/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, status: target }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to save');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      fetchData(); // re-sync on failure
    }
  }

  // Per-member summary from the current map.
  const summary = useMemo(() => {
    const out: Record<string, { present: number; absent: number; leave: number }> = {};
    for (const m of members) out[m.id] = { present: 0, absent: 0, leave: 0 };
    for (const [key, status] of Object.entries(map)) {
      const uid = key.split('_')[0];
      if (!out[uid]) continue;
      if (status === 'present') out[uid].present += 1;
      else if (status === 'paid_leave') out[uid].leave += 1;
      out[uid].absent += absentUnitsFor(status);
    }
    return out;
  }, [members, map]);

  if (authLoading) return <div className="py-16"><Loader size="lg" message="Loading..." /></div>;
  if (!isAdmin) return <div className="py-16 text-center text-gray-500 text-sm">Attendance is managed by your admin.</div>;
  if (!canPayroll) return <FeatureLocked feature="feature.payroll" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link href="/dashboard/payroll" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mb-1">
            <ArrowLeft size={13} /> Payroll
          </Link>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
            <CalendarCheck size={24} className="text-blue-600" /> Attendance
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setGeoOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
            <MapPin size={15} /> <span className="hidden sm:inline">Geo settings</span>
          </button>
          {/* Month nav */}
          <button onClick={() => setPeriod((p) => shiftPeriod(p, -1))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={() => setPeriod((p) => shiftPeriod(p, 1))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"><ChevronRight size={16} /></button>
        </div>
      </div>

      <OfficeLocationsModal isOpen={geoOpen} onClose={() => setGeoOpen(false)} onSaved={() => fetchData()} />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-400">Click a cell to cycle:</span>
        {ATTENDANCE_STATUSES.filter((s) => ATTENDANCE_CYCLE.includes(s.value)).map((s) => (
          <span key={s.value} className={`px-2 py-0.5 rounded font-semibold ${s.cell}`}>{s.short} · {s.label}</span>
        ))}
        <span className="text-gray-400">→ click again past Paid leave to clear</span>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      {/* Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12"><Loader message="Loading attendance..." /></div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No active team members.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold min-w-[160px]">Member</th>
                  {days.map((day) => (
                    <th key={day.d} className={`px-1.5 py-1 text-center font-medium w-8 ${day.weekday === 0 ? 'text-red-400' : ''} ${day.date === today ? 'bg-blue-100 text-blue-700 rounded-t' : ''}`}>
                      <div>{day.d}</div>
                      <div className="text-[10px] text-gray-400">{WD[day.weekday]}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold border-l border-gray-200">P</th>
                  <th className="px-2 py-2 text-center font-semibold">A</th>
                  <th className="px-2 py-2 text-center font-semibold">PL</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-800 min-w-[160px]">
                      <div className="truncate max-w-[150px]">{m.name}</div>
                    </td>
                    {days.map((day) => {
                      const status = map[`${m.id}_${day.date}`];
                      const def = getAttendanceStatus(status);
                      return (
                        <td key={day.d} className="p-0.5 text-center">
                          <button
                            type="button"
                            onClick={() => cycleCell(m.id, day.date)}
                            title={def ? def.label : 'Not marked'}
                            className={`w-7 h-7 rounded text-[11px] font-bold transition-colors ${def ? def.cell : 'bg-gray-50 text-gray-300 hover:bg-gray-100'}`}
                          >
                            {def ? def.short : '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center font-semibold text-green-700 border-l border-gray-200">{summary[m.id]?.present ?? 0}</td>
                    <td className="px-2 py-2 text-center font-semibold text-red-600">{summary[m.id]?.absent ?? 0}</td>
                    <td className="px-2 py-2 text-center font-semibold text-blue-600">{summary[m.id]?.leave ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        P = present days · A = chargeable absent units (half-day = 0.5) · PL = paid leaves taken.
        Geo check-in auto-marking arrives next.
      </p>
    </div>
  );
}
