'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { notificationsApi } from '@/lib/api';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import type { Notification } from '@openworkspace/api-types';

function timeAgo(date: string): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function notifIcon(type: Notification['type']) {
  if (type === 'TASK_ASSIGNED') return '📋';
  if (type === 'TASK_COMMENTED') return '💬';
  return '🔄';
}

function notifTitle(n: Notification): string {
  if (n.type === 'TASK_ASSIGNED') return `Assigned: ${n.data.taskTitle}`;
  if (n.type === 'TASK_COMMENTED') return `${n.data.actorName} commented on: ${n.data.taskTitle}`;
  return `${n.data.taskTitle} → ${n.data.newStatus}`;
}

interface Props {
  userId: string | undefined;
}

export function NotificationBell({ userId }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { unreadCount, setUnreadCount, markRead, markAllRead } = useNotifications(userId);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: !!userId,
  });

  // Sync unread count from fetched data (TanStack Query v5: no onSuccess)
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length);
  }, [notifications, setUnreadCount]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    if (n.projectId) {
      router.push(`/${locale}/workspaces/${n.data.workspaceSlug}/projects/${n.projectId}/board`);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-workspace)] text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--accent-workspace)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 10).length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No notifications yet</p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-[var(--border-subtle)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-overlay)]',
                    !n.read && 'bg-[var(--accent-workspace-bg)]',
                  )}
                >
                  <span className="mt-0.5 text-sm">{notifIcon(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm', !n.read ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                      {notifTitle(n)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {n.data.projectName} · {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-workspace)]" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
