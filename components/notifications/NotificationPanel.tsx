'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Bell, AlertTriangle, Clock, CalendarCheck,
  UserPlus, ChevronRight, CheckCheck,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  clientId?: string | null;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
}

interface Props {
  onClose: () => void;
}

const SEVERITY_STYLES: Record<string, { bg: string; dot: string; icon: string }> = {
  red:    { bg: 'bg-red-50', dot: 'bg-red-500', icon: 'text-red-500' },
  yellow: { bg: 'bg-amber-50', dot: 'bg-amber-400', icon: 'text-amber-500' },
  green:  { bg: 'bg-green-50', dot: 'bg-green-500', icon: 'text-green-500' },
};

const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  OVERDUE: AlertTriangle,
  DUE_TODAY: Clock,
  VISIT_TODAY: CalendarCheck,
  NEW_ASSIGNMENT: UserPlus,
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationPanel({ onClose }: Props) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? []);
        setUnreadCount(d.unreadCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch('/api/notifications', { method: 'POST', credentials: 'include' }).catch(() => {});
  }

  function handleClick(n: Notification) {
    if (!n.isRead) markRead(n.id);
    if (n.clientId) {
      onClose();
      router.push(`/dashboard/clients/${n.clientId}`);
    }
  }

  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-[340px] sm:w-[400px] bg-white border border-gray-200
        rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <Bell size={15} className="text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Notifications</h4>
            {unreadCount > 0 && (
              <p className="text-[11px] text-blue-600 font-medium">{unreadCount} unread</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium
                text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <CheckCheck size={12} />
              Read all
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
              <CheckCheck size={24} className="text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700">All caught up!</p>
            <p className="text-xs text-gray-400 text-center">
              No pending follow-ups or assignments. Great job!
            </p>
          </div>
        ) : (
          <>
            {/* Unread section */}
            {unread.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-400">
                  New
                </p>
                {unread.map((n) => (
                  <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
                ))}
              </div>
            )}

            {/* Read section */}
            {read.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-400">
                  Earlier
                </p>
                {read.map((n) => (
                  <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => { onClose(); router.push('/dashboard/my-work'); }}
            className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-1"
          >
            View all follow-ups →
          </button>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification: n, onClick }: { notification: Notification; onClick: () => void }) {
  const style = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.yellow;
  const Icon = TYPE_ICONS[n.type] ?? Bell;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors
        ${!n.isRead ? 'bg-blue-50/30' : ''}`}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon size={16} className={style.icon} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold truncate ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
            {n.title}
          </p>
          {!n.isRead && <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-gray-400">{timeAgo(n.createdAt)}</span>
          {n.clientId && (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-500 font-medium">
              View client <ChevronRight size={10} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
