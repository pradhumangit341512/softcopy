'use client';

import { useEffect, useState } from 'react';
import { Clock, LogIn, LogOut, XCircle, CalendarDays } from 'lucide-react';
import { Loader } from '@/components/common/Loader';

interface Session {
  id: string;
  loginAt: string;
  logoutAt: string | null;
  duration: number | null;
}

interface DaySummary {
  date: string;
  dayLabel: string;
  sessions: Session[];
  totalMinutes: number;
  isToday: boolean;
}

interface WeekSummary {
  totalDays: number;
  totalMinutes: number;
  totalHours: number;
  avgHoursPerDay: number;
}

interface Props {
  memberId: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function LoginHistory({ memberId }: Props) {
  const [dailySummary, setDailySummary] = useState<DaySummary[]>([]);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetch(`/api/team-performance/${memberId}/sessions`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        setDailySummary(data.dailySummary ?? []);
        setWeekSummary(data.weekSummary ?? null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [memberId]);

  if (loading) return <Loader size="sm" message="Loading login history..." />;
  if (error) return <p className="text-xs text-red-500">Error: {error}</p>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <CalendarDays size={14} className="text-blue-500" />
          Login History — Last 7 Days
        </h4>
        {weekSummary && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span><strong className="text-gray-900">{weekSummary.totalDays}</strong>/7 days</span>
            <span><strong className="text-gray-900">{weekSummary.totalHours}h</strong> total</span>
            <span>Avg <strong className="text-gray-900">{weekSummary.avgHoursPerDay}h</strong>/day</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {dailySummary.map((day) => (
          <div key={day.date} className="px-4 py-3">
            {/* Day header */}
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-gray-700">
                {day.dayLabel}
                <span className="ml-1.5 font-normal text-gray-400">{day.date}</span>
              </p>
              {day.sessions.length > 0 ? (
                <span className="text-xs text-gray-500">
                  {formatDuration(day.totalMinutes)}
                </span>
              ) : (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <XCircle size={10} /> Absent
                </span>
              )}
            </div>

            {/* Sessions for this day */}
            {day.sessions.length === 0 ? (
              <p className="text-xs text-gray-400 pl-4">No login recorded</p>
            ) : (
              <div className="space-y-1 pl-2">
                {day.sessions.map((s) => {
                  const isOnline = !s.logoutAt;
                  const dur = s.duration
                    ?? (s.logoutAt
                      ? Math.round((new Date(s.logoutAt).getTime() - new Date(s.loginAt).getTime()) / 60000)
                      : Math.round((Date.now() - new Date(s.loginAt).getTime()) / 60000));

                  return (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      {/* Status indicator */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />

                      {/* Login time */}
                      <span className="flex items-center gap-0.5 text-gray-700">
                        <LogIn size={10} className="text-green-500" />
                        {formatTime(s.loginAt)}
                      </span>

                      <span className="text-gray-300">→</span>

                      {/* Logout time or "Still online" */}
                      {isOnline ? (
                        <span className="text-green-600 font-semibold">Still online</span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-gray-700">
                          <LogOut size={10} className="text-red-400" />
                          {formatTime(s.logoutAt!)}
                        </span>
                      )}

                      {/* Duration */}
                      <span className="text-gray-400 ml-auto flex items-center gap-0.5">
                        <Clock size={10} />
                        {formatDuration(dur)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Week summary bar */}
      {weekSummary && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-xs">
          <span className="font-bold text-gray-700">Week Summary:</span>
          <span className={`font-semibold ${weekSummary.totalDays >= 5 ? 'text-green-700' : weekSummary.totalDays >= 3 ? 'text-amber-700' : 'text-red-700'}`}>
            {weekSummary.totalDays} day{weekSummary.totalDays !== 1 ? 's' : ''} active
          </span>
          <span className="text-gray-600">{weekSummary.totalHours}h total</span>
          <span className="text-gray-600">Avg {weekSummary.avgHoursPerDay}h/day</span>

          {/* Visual attendance bar */}
          <div className="flex gap-0.5 ml-auto">
            {[...Array(7)].map((_, i) => {
              const day = dailySummary[6 - i];
              const hasActivity = day && day.sessions.length > 0;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-bold ${
                    hasActivity
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                  title={day?.dayLabel ?? ''}
                >
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][new Date(day?.date ?? '').getDay()] ?? '?'}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
