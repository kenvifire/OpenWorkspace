'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { workspacesApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { buttonVariants } from '@/components/ui/button';
import { Plus, FolderKanban, Users, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
];

const AVATAR_GLOWS = [
  'shadow-[0_0_24px_oklch(0.68_0.18_285/0.3)]',
  'shadow-[0_0_24px_oklch(0.6_0.18_230/0.3)]',
  'shadow-[0_0_24px_oklch(0.72_0.16_150/0.3)]',
  'shadow-[0_0_24px_oklch(0.75_0.18_55/0.3)]',
  'shadow-[0_0_24px_oklch(0.65_0.20_350/0.3)]',
];

export default function DashboardPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const tw = useTranslations('workspace');
  const { user } = useAuth();
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
    enabled: !!user,
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greetingMorning');
    if (h < 18) return t('greetingAfternoon');
    return t('greetingEvening');
  })();

  return (
    <div className="min-h-full p-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-10 flex items-end justify-between"
      >
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)] mb-1">{greeting}</p>
          <h1 className="text-4xl font-bold text-white" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>
            {user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Welcome'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {workspaces.length > 0
              ? tw('projects', { count: workspaces.length })
              : t('getStarted')}
          </p>
        </div>
        <Link
          href={`/${locale}/workspaces/new`}
          className={buttonVariants({ className: 'shadow-[0_0_20px_oklch(0.68_0.18_285/0.4)] hover:shadow-[0_0_28px_oklch(0.68_0.18_285/0.6)] transition-shadow' })}
        >
          <Plus size={15} className="mr-1.5" />
          {t('newWorkspace')}
        </Link>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-[var(--bg-surface)]" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] py-28 text-center"
        >
          <div className="mb-6 relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-violet-500/10 border border-violet-500/20" />
            <div className="absolute -top-2 -right-2 h-6 w-6 rounded-lg bg-[oklch(0.75_0.15_210/0.15)] border border-[oklch(0.75_0.15_210/0.3)]" />
            <div className="absolute -bottom-2 -left-2 h-4 w-4 rounded-md bg-violet-500/20 border border-violet-500/30" />
            <FolderKanban size={28} className="text-violet-400 relative z-10" />
          </div>
          <p className="font-semibold text-zinc-200 text-lg" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>{t('noWorkspaces')}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-xs">{t('noWorkspacesDesc')}</p>
          <Link
            href={`/${locale}/workspaces/new`}
            className={buttonVariants({ className: 'mt-7 shadow-[0_0_20px_oklch(0.68_0.18_285/0.4)] hover:shadow-[0_0_28px_oklch(0.68_0.18_285/0.6)] transition-shadow' })}
          >
            <Plus size={14} className="mr-1.5" />
            {t('createFirstWorkspace')}
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws, i) => (
            <motion.div
              key={ws.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3, ease: 'easeOut' }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
            >
              <Link href={`/${locale}/workspaces/${ws.slug}`}>
                <div className="group relative overflow-hidden rounded-2xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] p-5 shadow-lg shadow-black/30 transition-all hover:border-[oklch(0.32_0.04_265)] hover:shadow-[0_8px_32px_black/50]">
                  <div className={`absolute right-0 top-0 h-28 w-28 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-sm font-bold text-white ${AVATAR_GLOWS[i % AVATAR_GLOWS.length]}`}>
                      {ws.name[0].toUpperCase()}
                    </div>
                    <ArrowRight size={15} className="text-zinc-600 group-hover:text-zinc-400 transition-colors mt-0.5" />
                  </div>
                  <div className="mt-3">
                    <p className="font-semibold text-zinc-100" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>{ws.name}</p>
                    {(ws as any).description && (
                      <p className="mt-0.5 text-sm text-[oklch(0.55_0.02_265)] line-clamp-1">{(ws as any).description}</p>
                    )}
                  </div>
                  <div className="mt-4 flex gap-4 text-xs text-[oklch(0.55_0.02_265)] border-t border-[oklch(0.22_0.02_265)] pt-3">
                    <span className="flex items-center gap-1.5">
                      <FolderKanban size={12} />
                      {tw('projects', { count: ws._count?.projects ?? 0 })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={12} />
                      {tw('members', { count: ws._count?.members ?? 0 })}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
