'use client';

import { use, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { marketplaceApi, workspacesApi, projectsApi } from '@/lib/api';
import type { ProjectRole } from '@openworkspace/api-types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Star, Bot, User, ArrowLeft, Copy, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';

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
        <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-200" />
      </div>
    );
  }
  if (!agent) return null;

  return (
    <div className="min-h-full p-8">
      <Link
        href={`/${locale}/marketplace`}
        className="mb-6 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Marketplace
      </Link>

      {/* Key banner */}
      {hired && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <p className="mb-2 text-sm font-semibold text-amber-800">Save this project key — it will not be shown again</p>
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white p-3">
            <code className="flex-1 break-all font-mono text-sm text-amber-900">{hired.rawProjectKey}</code>
            <button onClick={() => copy(hired.rawProjectKey)} className="shrink-0 rounded-lg p-1.5 text-amber-600 hover:bg-amber-100 transition-colors">
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
            <button onClick={() => setHired(null)} className="text-xs text-amber-600 hover:underline">Dismiss</button>
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
              <h1 className="text-2xl font-bold text-zinc-900">{agent.name}</h1>
              <p className="text-sm text-zinc-400">by {agent.provider.displayName}</p>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                {agent.aggregateRating != null && (
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={14} className={s <= Math.round(agent.aggregateRating!) ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'} />
                    ))}
                    <span className="ml-1 text-sm font-semibold text-zinc-700">{agent.aggregateRating.toFixed(1)}</span>
                    <span className="text-sm text-zinc-400">({agent.reviewCount})</span>
                  </div>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${agent.type === 'AI' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                  {agent.type === 'AI' ? 'AI Agent' : 'Human'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-zinc-600 leading-relaxed">{agent.description}</p>

          {/* Tags */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Capabilities</p>
            <div className="flex flex-wrap gap-2">
              {agent.capabilityTags.map((tag: string) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">{tag}</span>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-200" />

          {/* Reviews */}
          <div>
            <h2 className="mb-4 font-semibold text-zinc-900">Reviews</h2>
            {reviewData?.data?.length === 0 ? (
              <p className="text-sm text-zinc-400">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviewData?.data?.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
                          {r.reviewer?.name?.[0]}
                        </div>
                        <span className="text-sm font-medium text-zinc-800">{r.reviewer?.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} size={12} className={s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-zinc-600">{r.comment}</p>}
                    {r.providerResponse && (
                      <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
                        <span className="font-medium">Provider response: </span>{r.providerResponse}
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
          <div className="sticky top-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pricing</p>
              <p className="mt-1 text-3xl font-bold text-zinc-900">
                {agent.pricingModel === 'PER_JOB'
                  ? `$${((agent.pricePerJob ?? 0) / 100).toFixed(2)}`
                  : `$${((agent.pricePerToken ?? 0) / 100000).toFixed(4)}`}
              </p>
              <p className="text-sm text-zinc-400">
                {agent.pricingModel === 'PER_JOB' ? 'per job' : 'per token'}
              </p>
            </div>

            <p className="text-xs text-zinc-400">
              {agent._count?.projectAgents ?? 0} active project engagements
            </p>

            <div className="border-t border-zinc-100" />

            {!hiring ? (
              <Button className="w-full" onClick={() => setHiring(true)}>Hire for a project</Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Workspace</Label>
                  <Select value={selectedWorkspaceId} onValueChange={(v) => { setSelectedWorkspaceId(v ?? ''); setSelectedProjectId(''); }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select workspace" /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Project</Label>
                  <Select value={selectedProjectId} onValueChange={(v) => setSelectedProjectId(v ?? '')} disabled={!selectedWorkspaceId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole((v ?? 'DEVELOPER') as ProjectRole)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {['DEVELOPER','REVIEWER','DESIGNER','QA','COORDINATOR','CUSTOM'].map((r) => (
                        <SelectItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hireAgent.isError && (
                  <div className="flex items-start gap-1.5 rounded-xl bg-red-50 p-3 text-xs text-red-600">
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

            <p className="text-center text-xs text-zinc-400">
              A project agreement will be created. The project key activates after signing.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
