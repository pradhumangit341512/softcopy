'use client';

import { useEffect, useState } from 'react';
import {
  Clock, UserPlus, MessageSquare, CalendarCheck, ArrowRightLeft,
  RefreshCw, Edit3,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  userName?: string;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  created:        { icon: UserPlus,        color: 'text-green-600',  bg: 'bg-green-50' },
  status_change:  { icon: ArrowRightLeft,  color: 'text-blue-600',   bg: 'bg-blue-50' },
  note_added:     { icon: MessageSquare,   color: 'text-purple-600', bg: 'bg-purple-50' },
  visit_scheduled:{ icon: CalendarCheck,   color: 'text-amber-600',  bg: 'bg-amber-50' },
  follow_up_set:  { icon: Clock,           color: 'text-orange-600', bg: 'bg-orange-50' },
  updated:        { icon: Edit3,           color: 'text-gray-600',   bg: 'bg-gray-50' },
};

function getConfig(action: string) {
  return ACTION_CONFIG[action] || { icon: RefreshCw, color: 'text-gray-500', bg: 'bg-gray-50' };
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ActivityTimeline({ clientId }: { clientId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/activity-logs?clientId=${clientId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No activity recorded yet
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {logs.map((log, idx) => {
          const config = getConfig(log.action);
          const Icon = config.icon;
          const isLast = idx === logs.length - 1;

          return (
            <li key={log.id}>
              <div className="relative pb-8">
                {/* Connecting line */}
                {!isLast && (
                  <span
                    className="absolute left-4 top-8 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  {/* Icon */}
                  <div className={`relative flex h-8 w-8 items-center justify-center rounded-full ${config.bg} ring-4 ring-white`}>
                    <Icon size={14} className={config.color} />
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-800 font-medium leading-snug">
                        {log.description}
                      </p>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatTime(log.createdAt)}
                      </span>
                    </div>
                    {log.userName && (
                      <p className="text-xs text-gray-400 mt-0.5">by {log.userName}</p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
