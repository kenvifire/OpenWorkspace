'use client';

import { use, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { marketplaceApi, workspacesApi, projectsApi } from '@/lib/api';
import type { ProjectRole } from '@openworkspace/api-types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Star, Bot, User, ArrowLeft, Copy, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const locale = useLocale();

  const [hiring, setHiring] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [role, setRole] = useState<ProjectRole>('DEVELOPER');
  const [hired, setHired] = useState<{ rawProjectKey: string; projectAgentId: string; projectId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: agent, isLoading } = useQuery({
    queryKey: ['marketplace', agentId],
    queryFn: () => marketplaceApi.get(agentId),
  });

  const { data: reviewData } = useQuery({
    queryKey: ['reviews', agentId],
    queryFn: () => marketplaceApi.getReviews(agentId),
    enabled: !!agent,
  });

  const { data: workspacesRaw = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
    enabled: hiring,
  });
  const workspaces: { id: string; name: string; slug: string }[] = workspacesRaw;

  const { data: projects = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['projects', selectedWorkspaceId],
    queryFn: () => projectsApi.list(selectedWorkspaceId),
    enabled: !!selectedWorkspaceId,
  });

  const hireAgent = useMutation({
    mutationFn: () => projectsApi.hireAgent(selectedProjectId, { agentId, role }),
    onSuccess: (data) => {
      setHired({ rawProjectKey: data.rawKey, projectAgentId: data.projectAgent.id, projectId: selectedProjectId });
      setHiring(false);
    },
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-surface)]" />
      </div>
    );
  }
  if (!agent) return null;

  return (
    <div className="min-h-full p-8">
      <Link
        href={`/${locale}/marketplace`}
        className="mb-6 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <ArrowLeft size={14} /> Back to Marketplace
      </Link>

      {/* Key banner */}
      {hired && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-[var(--accent-skill-border)] bg-[var(--accent-skill-bg)] p-5"
        >
          <p className="mb-2 text-sm font-semibold text-[var(--accent-skill)]">Save this project key — it will not be shown again</p>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <code className="flex-1 break-all font-mono text-sm text-[var(--text-primary)]">{hired.rawProjectKey}</code>
            <button onClick={() => copy(hired.rawProjectKey)} className="shrink-0 rounded-lg p-1.5 text-[var(--accent-skill)] hover:bg-[var(--bg-elevated)] transition-colors">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Link
              href={`/${locale}/workspaces/${workspaces.find((w) => w.id === selectedWorkspaceId)?.slug}/projects/${hired.projectId}/settings`}
              className={buttonVariants({ size: 'sm' })}
            >
              Go to project settings
            </Link>
            <button onClick={() => setHired(null)} className="text-xs text-[var(--text-muted)] hover:underline">Dismiss</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Agent header */}
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
              {agent.type === 'AI' ? <Bot size={30} /> : <User size={30} />}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>{agent.name}</h1>
              <p className="text-sm text-[var(--text-muted)]">by {agent.provider.displayName}</p>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                {agent.aggregateRating != null && (
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={14} className={s <= Math.round(agent.aggregateRating!) ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-default)]'} />
                    ))}
                    <span className="ml-1 text-sm font-semibold text-[var(--text-secondary)]">{agent.aggregateRating.toFixed(1)}</span>
                    <span className="text-sm text-[var(--text-muted)]">({agent.reviewCount})</span>
                  </div>
                )}
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                  agent.type === 'AI'
                    ? 'bg-[var(--accent-agent-bg)] border-[var(--accent-agent-border)] text-[var(--accent-agent)]'
                    : 'bg-[var(--accent-skill-bg)] border-[var(--accent-skill-border)] text-[var(--accent-skill)]',
                )}>
                  {agent.type === 'AI' ? '✦ AI Agent' : '● Human'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[var(--text-secondary)] leading-relaxed">{agent.description}</p>

          {/* Tags */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Capabilities</p>
            <div className="flex flex-wrap gap-2">
              {agent.capabilityTags.map((tag: string) => (
                <span key={tag} className="rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-1 text-sm font-medium text-[var(--text-muted)]">{tag}</span>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border-subtle)]" />

          {/* Reviews */}
          <div>
            <h2 className="mb-4 font-semibold text-[var(--text-primary)]">Reviews</h2>
            {reviewData?.data?.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviewData?.data?.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-[var(--bg-surface)] p-4 ring-1 ring-[var(--border-default)]">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-muted)]">
                          {r.reviewer?.name?.[0]}
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{r.reviewer?.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} size={12} className={s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-default)]'} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-[var(--text-secondary)]">{r.comment}</p>}
                    {r.providerResponse && (
                      <div className="mt-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-primary)]">Provider response: </span>{r.providerResponse}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Hire card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="sticky top-6 rounded-2xl bg-[var(--bg-surface)] p-5 ring-1 ring-[var(--border-default)] space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pricing</p>
              <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
                {agent.pricingModel === 'PER_JOB'
                  ? `$${((agent.pricePerJob ?? 0) / 100).toFixed(2)}`
                  : `$${((agent.pricePerToken ?? 0) / 100000).toFixed(4)}`}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {agent.pricingModel === 'PER_JOB' ? 'per job' : 'per token'}
              </p>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              {agent._count?.projectAgents ?? 0} active project engagements
            </p>

            <div className="border-t border-[var(--border-subtle)]" />

            {!hiring ? (
              <Button className="w-full" onClick={() => setHiring(true)}>Hire for a project</Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--text-muted)]">Workspace</Label>
                  <Select value={selectedWorkspaceId} onValueChange={(v) => { setSelectedWorkspaceId(v ?? ''); setSelectedProjectId(''); }}>
                    <SelectTrigger className="w-full bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)]"><SelectValue placeholder="Select workspace" /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--text-muted)]">Project</Label>
                  <Select value={selectedProjectId} onValueChange={(v) => setSelectedProjectId(v ?? '')} disabled={!selectedWorkspaceId}>
                    <SelectTrigger className="w-full bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)]"><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[var(--text-muted)]">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole((v ?? 'DEVELOPER') as ProjectRole)}>
                    <SelectTrigger className="w-full bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)]"><SelectValue /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {['DEVELOPER','REVIEWER','DESIGNER','QA','COORDINATOR','CUSTOM'].map((r) => (
                        <SelectItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hireAgent.isError && (
                  <div className="flex items-start gap-1.5 rounded-xl bg-[var(--status-error)]/10 border border-[var(--status-error)]/25 p-3 text-xs text-[var(--status-error)]">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    {(hireAgent.error as any)?.response?.data?.message ?? 'Failed to hire agent'}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setHiring(false); hireAgent.reset(); }}>Cancel</Button>
                  <Button className="flex-1" disabled={!selectedProjectId || hireAgent.isPending} onClick={() => hireAgent.mutate()}>
                    {hireAgent.isPending ? 'Hiring…' : 'Confirm hire'}
                  </Button>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-[var(--text-muted)]">
              A project agreement will be created. The project key activates after signing.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
