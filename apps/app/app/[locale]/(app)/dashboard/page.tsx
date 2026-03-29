'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
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

export default function DashboardPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
    enabled: !!user,
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-full p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 flex items-end justify-between"
      >
        <div>
          <p className="text-sm font-medium text-zinc-400">{greeting}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-zinc-900">
            {user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Welcome'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {workspaces.length > 0
              ? `You have ${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`
              : 'Create your first workspace to get started'}
          </p>
        </div>
        <Link href={`/${locale}/workspaces/new`} className={buttonVariants()}>
          <Plus size={15} className="mr-1.5" />
          New Workspace
        </Link>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-24 text-center"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <FolderKanban size={26} className="text-zinc-400" />
          </div>
          <p className="font-semibold text-zinc-700">No workspaces yet</p>
          <p className="mt-1 text-sm text-zinc-400">Workspaces help you organise projects and team members.</p>
          <Link href={`/${locale}/workspaces/new`} className={buttonVariants({ className: 'mt-6' })}>
            <Plus size={14} className="mr-1.5" />
            Create your first workspace
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
                <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 transition-shadow hover:shadow-md">
                  {/* gradient accent */}
                  <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />

                  <div className="flex items-start justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-sm font-bold text-white shadow-sm`}>
                      {ws.name[0].toUpperCase()}
                    </div>
                    <ArrowRight size={15} className="text-zinc-300 group-hover:text-zinc-500 transition-colors mt-0.5" />
                  </div>

                  <div className="mt-3">
                    <p className="font-semibold text-zinc-900">{ws.name}</p>
                    {(ws as any).description && (
                      <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">{(ws as any).description}</p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-4 text-xs text-zinc-400 border-t border-zinc-100 pt-3">
                    <span className="flex items-center gap-1.5">
                      <FolderKanban size={12} />
                      {ws._count?.projects ?? 0} projects
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={12} />
                      {ws._count?.members ?? 0} members
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
