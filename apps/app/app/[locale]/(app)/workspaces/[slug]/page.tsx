'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { workspacesApi, projectsApi } from '@/lib/api';
import type { WorkspaceMemberRole } from '@openworkspace/api-types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FolderKanban, Users, Trash2, UserPlus, Settings, ArrowRight, Bot, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const locale = useLocale();
  const t = useTranslations('workspace');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('MEMBER');

  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => workspacesApi.get(slug),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', workspace?.id],
    queryFn: () => projectsApi.list(workspace!.id),
    enabled: !!workspace?.id,
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => workspacesApi.removeMember(workspace!.id, memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace', slug] }),
  });

  const inviteMember = useMutation({
    mutationFn: () => workspacesApi.inviteMember(workspace!.id, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace', slug] });
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-[oklch(0.12_0.014_265)]" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-64 animate-pulse rounded-2xl bg-[oklch(0.12_0.014_265)]" />
          <div className="h-64 animate-pulse rounded-2xl bg-[oklch(0.12_0.014_265)]" />
        </div>
      </div>
    );
  }
  if (!workspace) return null;

  return (
    <div className="min-h-full p-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-1.5 text-xs text-[oklch(0.55_0.02_265)]">
        <Link href={`/${locale}/dashboard`} className="hover:text-zinc-300 transition-colors">{tn('dashboard')}</Link>
        <ChevronRight size={12} />
        <span className="text-zinc-300">{workspace.name}</span>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-lg font-bold text-white shadow-[0_0_20px_oklch(0.68_0.18_285/0.4)]">
            {workspace.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>{workspace.name}</h1>
            <p className="text-sm text-[oklch(0.55_0.02_265)]">/{workspace.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/workspaces/${slug}/settings`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Settings size={13} className="mr-1.5" /> {tn('settings')}
          </Link>
          <Link href={`/${locale}/workspaces/${slug}/projects/new`} className={buttonVariants({ size: 'sm', className: 'shadow-[0_0_16px_oklch(0.68_0.18_285/0.35)] hover:shadow-[0_0_24px_oklch(0.68_0.18_285/0.5)] transition-shadow' })}>
            <Plus size={14} className="mr-1.5" /> {t('newProject')}
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Projects */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-2">
            <FolderKanban size={14} className="text-[oklch(0.55_0.02_265)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.55_0.02_265)]">{tn('projects')}</h2>
            <span className="rounded-full bg-[oklch(0.22_0.02_265)] px-1.5 py-0.5 text-[11px] font-medium text-[oklch(0.55_0.02_265)]">{projects.length}</span>
          </div>

          {projectsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[oklch(0.12_0.014_265)]" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] py-16 text-center">
              <FolderKanban size={28} className="mb-3 text-[oklch(0.22_0.02_265)]" />
              <p className="text-sm font-medium text-[oklch(0.55_0.02_265)]">{t('noProjects')}</p>
              <Link href={`/${locale}/workspaces/${slug}/projects/new`} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-3' })}>
                {t('createFirstProject')}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                >
                  <Link href={`/${locale}/workspaces/${slug}/projects/${p.id}/${(p._count?.tasks ?? 0) === 0 ? 'settings' : 'board'}`}>
                    <div className="group flex items-center gap-4 rounded-2xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] p-4 shadow-lg shadow-black/30 hover:border-[oklch(0.32_0.04_265)] hover:shadow-[0_8px_32px_black/50] transition-all">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_0_16px_oklch(0.6_0.18_230/0.3)]">
                        <FolderKanban size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-100">{p.name}</p>
                        {p.description && (
                          <p className="mt-0.5 text-sm text-[oklch(0.55_0.02_265)] line-clamp-1">{p.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-xs text-[oklch(0.55_0.02_265)]">
                        <span className="flex items-center gap-1">
                          <FolderKanban size={11} />
                          {t('tasks', { count: p._count?.tasks ?? 0 })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bot size={11} />
                          {t('members', { count: p._count?.projectAgents ?? 0 })}
                        </span>
                        <ArrowRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Members */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[oklch(0.55_0.02_265)]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.55_0.02_265)]">{t('membersHeading')}</h2>
              <span className="rounded-full bg-[oklch(0.22_0.02_265)] px-1.5 py-0.5 text-[11px] font-medium text-[oklch(0.55_0.02_265)]">{workspace.members?.length ?? 0}</span>
            </div>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[oklch(0.55_0.02_265)] hover:bg-[oklch(0.22_0.02_265)] hover:text-zinc-300 transition-colors"
            >
              <UserPlus size={12} /> {t('invite')}
            </button>
          </div>

          {showInvite && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 rounded-2xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] p-4 shadow-lg shadow-black/30 space-y-2"
            >
              <Input
                placeholder={t('inviteEmailPlaceholder')}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-8 text-sm"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole((v ?? 'MEMBER') as WorkspaceMemberRole)}>
                <SelectTrigger className="h-8 text-sm w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="MEMBER">{t('memberRole')}</SelectItem>
                  <SelectItem value="OWNER">{t('ownerRole')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowInvite(false)}>{tc('cancel')}</Button>
                <Button size="sm" className="flex-1" disabled={!inviteEmail || inviteMember.isPending} onClick={() => inviteMember.mutate()}>
                  {inviteMember.isPending ? t('inviting') : t('invite')}
                </Button>
              </div>
              {inviteMember.isError && (
                <p className="text-xs text-red-400">{(inviteMember.error as any)?.response?.data?.message ?? t('failedToInvite')}</p>
              )}
            </motion.div>
          )}

          <div className="rounded-2xl border border-[oklch(0.22_0.02_265)] bg-[oklch(0.12_0.014_265)] shadow-lg shadow-black/30 divide-y divide-[oklch(0.22_0.02_265)]">
            {workspace.members?.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 text-xs font-semibold text-white border border-[oklch(0.22_0.02_265)]">
                  {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{m.user?.name}</p>
                  <p className="text-xs text-[oklch(0.55_0.02_265)] truncate">{m.user?.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    (m.role as string) === 'OWNER' ? 'bg-violet-500/20 text-violet-300' :
                    (m.role as string) === 'ADMIN' ? 'bg-sky-500/20 text-sky-300' :
                    'bg-[oklch(0.22_0.02_265)] text-[oklch(0.55_0.02_265)]'
                  }`}>{m.role}</span>
                  {m.role !== 'OWNER' && (
                    <button
                      onClick={() => removeMember.mutate(m.userId)}
                      className="ml-1 rounded p-0.5 text-[oklch(0.22_0.02_265)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
