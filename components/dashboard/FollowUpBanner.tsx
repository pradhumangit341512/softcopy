'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';

interface BannerData {
  overdue: number;
  dueToday: number;
  overdueClients: string[];
  todayClients: string[];
}

export function FollowUpBanner() {
  const [data, setData] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const notifs = d.notifications ?? [];
        const overdue = notifs.filter((n: { type: string; isRead: boolean }) => n.type === 'OVERDUE');
        const today = notifs.filter((n: { type: string }) => n.type === 'DUE_TODAY');
        setData({
          overdue: overdue.length,
          dueToday: today.length,
          overdueClients: overdue.slice(0, 2).map((n: { title: string }) => n.title.replace('Overdue: ', '')),
          todayClients: today.slice(0, 2).map((n: { title: string }) => n.title.replace('Today: ', '')),
        });
      })
      .catch(() => {});
  }, []);

  if (!data || dismissed) return null;
  if (data.overdue === 0 && data.dueToday === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-green-600 shrink-0" />
        <p className="text-sm font-medium text-green-800">
          All caught up! No pending follow-ups.
        </p>
      </div>
    );
  }

  const isOverdue = data.overdue > 0;
  const bgColor = isOverdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const textColor = isOverdue ? 'text-red-800' : 'text-amber-800';
  const Icon = isOverdue ? AlertTriangle : Clock;
  const iconColor = isOverdue ? 'text-red-500' : 'text-amber-500';

  const names = isOverdue ? data.overdueClients : data.todayClients;
  const count = isOverdue ? data.overdue : data.dueToday;
  const label = isOverdue ? 'overdue follow-up' : 'follow-up due today';

  return (
    <div className={`border rounded-xl px-4 py-3 flex items-start sm:items-center gap-3 ${bgColor}`}>
      <Icon size={18} className={`${iconColor} shrink-0 mt-0.5 sm:mt-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${textColor}`}>
          You have {count} {label}{count > 1 ? 's' : ''}
          {data.overdue > 0 && data.dueToday > 0 && (
            <span className="font-normal"> and {data.dueToday} due today</span>
          )}
        </p>
        {names.length > 0 && (
          <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>
            {names.join(' · ')}
            {count > 2 && ` + ${count - 2} more`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard/my-work"
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            isOverdue
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          }`}
        >
          View all →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="w-6 h-6 rounded-lg hover:bg-white/50 flex items-center justify-center text-gray-400"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
