'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { workspacesApi, projectsApi } from '@/lib/api';
import type { WorkspaceMemberRole } from '@openworkspace/api-types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderKanban, Users, Trash2, UserPlus, Settings, ArrowRight, Bot } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const locale = useLocale();
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
        <div className="h-10 w-48 animate-pulse rounded-xl bg-zinc-200" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-64 animate-pulse rounded-2xl bg-zinc-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-200" />
        </div>
      </div>
    );
  }
  if (!workspace) return null;

  return (
    <div className="min-h-full p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-lg font-bold text-white shadow-sm">
            {workspace.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{workspace.name}</h1>
            <p className="text-sm text-zinc-400">/{workspace.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/workspaces/${slug}/settings`} className={buttonVariants({ variant: 'outline' })}>
            <Settings size={13} className="mr-1.5" /> Settings
          </Link>
          <Link href={`/${locale}/workspaces/${slug}/projects/new`} className={buttonVariants()}>
            <Plus size={14} className="mr-1.5" /> New Project
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
            <FolderKanban size={14} className="text-zinc-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Projects</h2>
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">{projects.length}</span>
          </div>

          {projectsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-200" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-16 text-center">
              <FolderKanban size={28} className="mb-3 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No projects yet</p>
              <Link href={`/${locale}/workspaces/${slug}/projects/new`} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-3' })}>
                Create first project
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
                    <div className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80 hover:shadow-md transition-shadow">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
                        <FolderKanban size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-900">{p.name}</p>
                        {p.description && (
                          <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">{p.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <FolderKanban size={11} />
                          {p._count?.tasks ?? 0} tasks
                        </span>
                        <span className="flex items-center gap-1">
                          <Bot size={11} />
                          {p._count?.projectAgents ?? 0} agents
                        </span>
                        <ArrowRight size={14} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
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
              <Users size={14} className="text-zinc-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Members</h2>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">{workspace.members?.length ?? 0}</span>
            </div>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
            >
              <UserPlus size={12} /> Invite
            </button>
          </div>

          {showInvite && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80 space-y-2"
            >
              <Input
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-8 text-sm"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole((v ?? 'MEMBER') as WorkspaceMemberRole)}>
                <SelectTrigger className="h-8 text-sm w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button size="sm" className="flex-1" disabled={!inviteEmail || inviteMember.isPending} onClick={() => inviteMember.mutate()}>
                  {inviteMember.isPending ? 'Inviting…' : 'Invite'}
                </Button>
              </div>
              {inviteMember.isError && (
                <p className="text-xs text-red-500">{(inviteMember.error as any)?.response?.data?.message ?? 'Failed to invite'}</p>
              )}
            </motion.div>
          )}

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80 divide-y divide-zinc-100">
            {workspace.members?.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-500 text-xs font-semibold text-white">
                  {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{m.user?.name}</p>
                  <p className="text-xs text-zinc-400 truncate">{m.user?.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    (m.role as string) === 'OWNER' ? 'bg-violet-100 text-violet-700' :
                    (m.role as string) === 'ADMIN' ? 'bg-sky-100 text-sky-700' :
                    'bg-zinc-100 text-zinc-600'
                  }`}>{m.role}</span>
                  {m.role !== 'OWNER' && (
                    <button
                      onClick={() => removeMember.mutate(m.userId)}
                      className="ml-1 rounded p-0.5 text-zinc-300 hover:text-red-400 transition-colors"
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
