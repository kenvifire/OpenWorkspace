'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { myAgentsApi, projectsApi, workspacesApi, planningAgentApi, skillsApi, mcpsApi } from '@/lib/api';
import type { CreatePersonalAgentDto, UpdatePersonalAgentDto, PlanningAgentConfig, Skill, Mcp } from '@/lib/api';
import type { Agent, Project } from '@openworkspace/api-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgentVersion } from '@openworkspace/api-types';
import { Bot, Plus, Pencil, Trash2, Eye, EyeOff, ChevronRight, Cpu, Layers, GitBranch, RotateCcw, ChevronDown, Brain, Zap, Globe, Check, X, KeyRound } from 'lucide-react';
import { useLocale } from 'next-intl';

const LLM_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic', color: 'bg-orange-100 text-orange-700' },
  { value: 'openai', label: 'OpenAI', color: 'bg-green-100 text-green-700' },
  { value: 'gemini', label: 'Google Gemini', color: 'bg-blue-100 text-blue-700' },
  { value: 'custom', label: 'Custom', color: 'bg-zinc-100 text-zinc-600' },
];

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  custom: '',
};

const PROJECT_ROLES = [
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'REVIEWER', label: 'Reviewer' },
  { value: 'DESIGNER', label: 'Designer' },
  { value: 'QA', label: 'QA' },
  { value: 'COORDINATOR', label: 'Coordinator' },
  { value: 'CUSTOM', label: 'Custom' },
];

// ─── Agent Form ───────────────────────────────────────────────────────────────

function AgentForm({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: Agent;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [llmProvider, setLlmProvider] = useState<string>(initial?.llmProvider ?? 'anthropic');
  const [modelName, setModelName] = useState(initial?.modelName ?? DEFAULT_MODELS['anthropic']);
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [temperature, setTemperature] = useState(initial?.temperature?.toString() ?? '0.7');
  const [maxTokens, setMaxTokens] = useState(initial?.maxTokens?.toString() ?? '');
  const [maxIterations, setMaxIterations] = useState(initial?.maxIterations?.toString() ?? '20');

  const handleProviderChange = (val: string | null) => {
    const v = val ?? 'anthropic';
    setLlmProvider(v);
    setModelName(DEFAULT_MODELS[v] ?? '');
  };

  const buildDto = (): CreatePersonalAgentDto | UpdatePersonalAgentDto => ({
    name,
    description: description || undefined,
    llmProvider,
    modelName,
    systemPrompt: systemPrompt || undefined,
    apiKey: apiKey || undefined,
    temperature: temperature ? Number(temperature) : undefined,
    maxTokens: maxTokens ? Number(maxTokens) : undefined,
    maxIterations: maxIterations ? Number(maxIterations) : undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => myAgentsApi.create(buildDto() as CreatePersonalAgentDto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-agents'] }); onSuccess(); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: () => myAgentsApi.update(initial!.id, buildDto()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-agents'] }); onSuccess(); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initial) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Code Assistant" required minLength={2} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" maxLength={2000} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>LLM Provider</Label>
          <Select value={llmProvider} onValueChange={(v) => handleProviderChange(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {LLM_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. claude-sonnet-4-6" required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>System Prompt</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant that..."
          rows={5}
          maxLength={8000}
          className="resize-none font-mono text-sm"
        />
        <p className="text-xs text-zinc-400">{systemPrompt.length}/8000</p>
      </div>

      <div className="space-y-1.5">
        <Label>API Key {initial && <span className="text-zinc-400">(leave blank to keep current)</span>}</Label>
        <div className="relative">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-... (overrides workspace key)"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Temperature</Label>
          <Input type="number" value={temperature} onChange={(e) => setTemperature(e.target.value)} min={0} max={2} step={0.1} />
        </div>
        <div className="space-y-1.5">
          <Label>Max Tokens</Label>
          <Input type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} min={1} placeholder="Default" />
        </div>
        <div className="space-y-1.5">
          <Label>Max Iterations</Label>
          <Input type="number" value={maxIterations} onChange={(e) => setMaxIterations(e.target.value)} min={1} max={100} />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500">{(error as any)?.response?.data?.message ?? 'Something went wrong'}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Create agent'}
        </Button>
      </div>
    </form>
  );
}

// ─── Add to Project dialog ────────────────────────────────────────────────────

function AddToProjectDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const locale = useLocale();
  const qc = useQueryClient();
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: workspaces = [] } = useQuery({ queryKey: ['workspaces'], queryFn: workspacesApi.list });
  const selectedWorkspace = workspaces.find((w: any) => w.slug === workspaceSlug);
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', selectedWorkspace?.id],
    queryFn: () => projectsApi.list(selectedWorkspace!.id),
    enabled: !!selectedWorkspace,
  });

  const hire = useMutation({
    mutationFn: () => projectsApi.hireAgent(projectId, { agentId: agent.id, role: role as any }),
    onSuccess: (data: any) => {
      setRawKey(data.rawProjectKey ?? data.rawKey ?? null);
      qc.invalidateQueries({ queryKey: ['project-agents', projectId] });
    },
  });

  const copy = async () => {
    if (!rawKey) return;
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (rawKey) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">Agent added. The project key is shown once — store it securely.</p>
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <code className="flex-1 break-all font-mono text-xs text-amber-900">{rawKey}</code>
          <Button size="sm" variant="outline" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Link href={`/${locale}/workspaces/${workspaceSlug}/projects/${projectId}/settings`} className={buttonVariants()}>
            View project <ChevronRight size={14} className="ml-1" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Workspace</Label>
        <Select value={workspaceSlug} onValueChange={(v) => { setWorkspaceSlug(v ?? ''); setProjectId(''); }}>
          <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
          <SelectContent>
            {workspaces.map((w: any) => <SelectItem key={w.slug} value={w.slug}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {selectedWorkspace && (
        <div className="space-y-1.5">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={(v) => setProjectId(v ?? '')}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {projects.map((p: Project) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {projectId && (
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v ?? 'DEVELOPER')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {PROJECT_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {hire.error && <p className="text-sm text-red-500">{(hire.error as any)?.response?.data?.message ?? 'Failed to add agent'}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => hire.mutate()} disabled={!projectId || hire.isPending}>
          {hire.isPending ? 'Adding…' : 'Add to project'}
        </Button>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-100 text-orange-700',
  openai: 'bg-green-100 text-green-700',
  gemini: 'bg-blue-100 text-blue-700',
};

function AgentVersionsPanel({ agent }: { agent: Agent }) {
  const qc = useQueryClient();
  const [publishLabel, setPublishLabel] = useState('');

  const versions: AgentVersion[] = (agent as any).versions ?? [];
  const activeVersionId: string | null = (agent as any).activeVersionId ?? null;

  const updateCache = (updated: Agent) => {
    qc.setQueryData(['my-agents'], (old: Agent[] | undefined) =>
      old?.map((a) => (a.id === updated.id ? updated : a)) ?? [updated],
    );
  };

  const publishVersion = useMutation({
    mutationFn: () => myAgentsApi.publishVersion(agent.id, publishLabel || undefined),
    onSuccess: (updated) => { updateCache(updated); setPublishLabel(''); },
  });

  const deleteVersion = useMutation({
    mutationFn: (versionId: string) => myAgentsApi.deleteVersion(agent.id, versionId),
    onSuccess: updateCache,
  });

  const activateVersion = useMutation({
    mutationFn: (versionId: string | null) => myAgentsApi.activateVersion(agent.id, versionId),
    onSuccess: updateCache,
  });

  return (
    <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-500">{versions.length}/3 versions</span>
          {activeVersionId === null && versions.length > 0 && (
            <span className="text-[10px] text-zinc-400">(using draft)</span>
          )}
        </div>
        {versions.length < 3 && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Label (optional)"
              value={publishLabel}
              onChange={(e) => setPublishLabel(e.target.value)}
              className="h-7 w-32 rounded-md border border-zinc-200 bg-white px-2.5 text-xs outline-none focus:border-zinc-400"
            />
            <Button size="sm" className="h-7 text-xs" disabled={publishVersion.isPending} onClick={() => publishVersion.mutate()}>
              {publishVersion.isPending ? '…' : 'Publish'}
            </Button>
          </div>
        )}
      </div>

      {publishVersion.isError && (
        <p className="text-xs text-red-500">{(publishVersion.error as any)?.response?.data?.message ?? 'Failed to publish'}</p>
      )}

      {versions.length === 0 ? (
        <p className="text-xs text-zinc-400">No versions yet. Publish to snapshot the current config.</p>
      ) : (
        <div className="space-y-1.5">
          {versions.map((v) => {
            const isActive = activeVersionId === v.id;
            return (
              <div
                key={v.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${isActive ? 'border-sky-200 bg-sky-50' : 'border-zinc-100 bg-white'}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${isActive ? 'bg-sky-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                  v{v.versionNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-700 truncate">{v.label ?? `Version ${v.versionNumber}`}</p>
                  <p className="text-[10px] text-zinc-400">{new Date(v.publishedAt).toLocaleDateString()}</p>
                </div>
                {isActive && (
                  <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Active</span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {isActive ? (
                    <button
                      onClick={() => activateVersion.mutate(null)}
                      disabled={activateVersion.isPending}
                      className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-800 transition-colors"
                    >
                      <RotateCcw size={9} /> Draft
                    </button>
                  ) : (
                    <button
                      onClick={() => activateVersion.mutate(v.id)}
                      disabled={activateVersion.isPending}
                      className="flex items-center gap-1 rounded-md bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-sky-700 transition-colors"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => deleteVersion.mutate(v.id)}
                    disabled={deleteVersion.isPending}
                    className="rounded p-0.5 text-zinc-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Agent Capabilities Panel (Skills + MCPs) ─────────────────────────────────

function AgentCapabilitiesPanel({ agent }: { agent: Agent }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'skills' | 'mcps'>('skills');

  const { data: allSkills = [] } = useQuery<Skill[]>({
    queryKey: ['my-skills'],
    queryFn: skillsApi.list,
  });

  const { data: allMcps = [] } = useQuery<Mcp[]>({
    queryKey: ['my-mcps'],
    queryFn: mcpsApi.list,
  });

  const { data: agentSkills = [] } = useQuery<any[]>({
    queryKey: ['agent-skills', agent.id],
    queryFn: () => myAgentsApi.listSkills(agent.id),
  });

  const { data: agentMcps = [] } = useQuery<any[]>({
    queryKey: ['agent-mcps', agent.id],
    queryFn: () => myAgentsApi.listMcps(agent.id),
  });

  const assignedSkillIds = new Set(agentSkills.map((s: any) => s.skillId));
  const assignedMcpIds = new Set(agentMcps.map((m: any) => m.mcpId));

  const assignSkill = useMutation({
    mutationFn: (skillId: string) => myAgentsApi.assignSkill(agent.id, skillId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-skills', agent.id] });
      qc.invalidateQueries({ queryKey: ['my-skills'] });
    },
  });

  const removeSkill = useMutation({
    mutationFn: (skillId: string) => myAgentsApi.removeSkill(agent.id, skillId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-skills', agent.id] });
      qc.invalidateQueries({ queryKey: ['my-skills'] });
    },
  });

  const assignMcp = useMutation({
    mutationFn: (mcpId: string) => myAgentsApi.assignMcp(agent.id, mcpId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-mcps', agent.id] }),
  });

  const removeMcp = useMutation({
    mutationFn: (mcpId: string) => myAgentsApi.removeMcp(agent.id, mcpId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-mcps', agent.id] }),
  });

  return (
    <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
      {/* Tabs */}
      <div className="flex gap-3 border-b border-zinc-200">
        {(['skills', 'mcps'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
              tab === t ? 'border-zinc-800 text-zinc-800' : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {t === 'skills' ? (
              <span className="flex items-center gap-1.5"><Zap size={11} /> Skills</span>
            ) : (
              <span className="flex items-center gap-1.5"><Globe size={11} /> MCPs</span>
            )}
          </button>
        ))}
      </div>

      {/* Skills tab */}
      {tab === 'skills' && (
        allSkills.length === 0 ? (
          <p className="text-xs text-zinc-400">No skills yet. Create one in the Skills page.</p>
        ) : (
          <div className="space-y-1.5">
            {allSkills.map((skill) => {
              const assigned = assignedSkillIds.has(skill.id);
              return (
                <div key={skill.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ${skill.type === 'WEBHOOK' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {skill.type === 'WEBHOOK' ? <Globe size={11} /> : <Zap size={11} />}
                    </div>
                    <span className="text-sm font-medium text-zinc-800 truncate">{skill.name}</span>
                    <span className="shrink-0 text-xs text-zinc-400 truncate hidden sm:block">{skill.description}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={assigned ? 'outline' : 'default'}
                    className="h-7 text-xs shrink-0 ml-2"
                    disabled={assignSkill.isPending || removeSkill.isPending}
                    onClick={() => assigned ? removeSkill.mutate(skill.id) : assignSkill.mutate(skill.id)}
                  >
                    {assigned ? <><X size={11} className="mr-1" />Remove</> : <><Check size={11} className="mr-1" />Assign</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* MCPs tab */}
      {tab === 'mcps' && (
        allMcps.length === 0 ? (
          <p className="text-xs text-zinc-400">No MCPs yet. Create one in the MCP page.</p>
        ) : (
          <div className="space-y-1.5">
            {allMcps.map((mcp) => {
              const assigned = assignedMcpIds.has(mcp.id);
              return (
                <div key={mcp.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500 text-white">
                      <Globe size={11} />
                    </div>
                    <span className="text-sm font-medium text-zinc-800 truncate">{mcp.name}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      mcp.transport === 'SSE' ? 'bg-blue-100 text-blue-700' :
                      mcp.transport === 'HTTP' ? 'bg-green-100 text-green-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>{mcp.transport}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={assigned ? 'outline' : 'default'}
                    className="h-7 text-xs shrink-0 ml-2"
                    disabled={assignMcp.isPending || removeMcp.isPending}
                    onClick={() => assigned ? removeMcp.mutate(mcp.id) : assignMcp.mutate(mcp.id)}
                  >
                    {assigned ? <><X size={11} className="mr-1" />Remove</> : <><Check size={11} className="mr-1" />Assign</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [addingToProject, setAddingToProject] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => myAgentsApi.delete(agent.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-agents'] }),
  });

  const activeHires = (agent as any)._count?.projectAgents ?? 0;
  const versions: AgentVersion[] = (agent as any).versions ?? [];
  const activeVersionId: string | null = (agent as any).activeVersionId ?? null;
  const providerColor = PROVIDER_COLORS[agent.llmProvider ?? ''] ?? 'bg-zinc-100 text-zinc-600';

  if (editing) {
    return (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Edit Agent</CardTitle></CardHeader>
        <CardContent>
          <AgentForm initial={agent} onClose={() => setEditing(false)} onSuccess={() => setEditing(false)} />
        </CardContent>
      </Card>
    );
  }

  if (addingToProject) {
    return (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Add "{agent.name}" to Project</CardTitle></CardHeader>
        <CardContent>
          <AddToProjectDialog agent={agent} onClose={() => setAddingToProject(false)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80 hover:shadow-md transition-shadow"
    >
      {/* gradient bg accent */}
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 -translate-y-10 translate-x-10 rounded-full bg-sky-400/10 blur-2xl group-hover:bg-sky-400/20 transition-opacity" />

      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
          <Bot size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-zinc-900">{agent.name}</h3>
            {agent.llmProvider && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${providerColor}`}>
                {agent.llmProvider}
              </span>
            )}
            {activeVersionId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                <GitBranch size={9} />
                {versions.find((v) => v.id === activeVersionId)?.label ?? `v${versions.find((v) => v.id === activeVersionId)?.versionNumber}`}
              </span>
            )}
          </div>
          {agent.description && (
            <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">{agent.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
            {agent.modelName && (
              <span className="flex items-center gap-1">
                <Cpu size={11} />
                {agent.modelName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Layers size={11} />
              {activeHires} project{activeHires !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setVersionsOpen((o) => !o)}
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <GitBranch size={11} />
              {versions.length} version{versions.length !== 1 ? 's' : ''}
              <motion.span animate={{ rotate: versionsOpen ? 180 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronDown size={10} />
              </motion.span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant={capabilitiesOpen ? 'default' : 'outline'} onClick={() => setCapabilitiesOpen((o) => !o)} className="text-xs">
            <Zap size={11} className="mr-1" /> Skills & MCPs
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddingToProject(true)} className="text-xs">
            Add to project
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)} className="h-8 w-8">
            <Pencil size={13} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => { if (confirm(`Delete "${agent.name}"?`)) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {agent.systemPrompt && (
        <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-400 font-mono line-clamp-2">{agent.systemPrompt}</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {versionsOpen && (
          <motion.div
            key="versions"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
            className="overflow-hidden"
          >
            <AgentVersionsPanel agent={agent} />
          </motion.div>
        )}
        {capabilitiesOpen && (
          <motion.div
            key="capabilities"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
            className="overflow-hidden"
          >
            <AgentCapabilitiesPanel agent={agent} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Planning Agent Card ──────────────────────────────────────────────────────

function PlanningAgentCard({ config }: { config: PlanningAgentConfig }) {
  const qc = useQueryClient();
  const [promptOpen, setPromptOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(config.userDefaultPrompt);
  const [provider, setProvider] = useState(config.provider ?? '');
  const [model, setModel] = useState(config.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const updateConfig = useMutation({
    mutationFn: (data: Parameters<typeof planningAgentApi.updateConfig>[0]) =>
      planningAgentApi.updateConfig(data),
    onSuccess: (updated) => qc.setQueryData(['planning-agent-config'], updated),
  });

  const handleProviderChange = (v: string) => {
    setProvider(v);
    setModel(DEFAULT_MODELS[v] ?? '');
  };

  const saveProviderConfig = () => {
    updateConfig.mutate({
      provider: provider || null,
      model: model || null,
      apiKey: apiKey || undefined,
    });
    setApiKey('');
  };

  const savePrompt = () => updateConfig.mutate({ userDefaultPrompt: draftPrompt });

  const isDirty = draftPrompt !== config.userDefaultPrompt;
  const providerDirty = provider !== (config.provider ?? '') || model !== (config.model ?? '') || !!apiKey;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 -translate-y-10 translate-x-10 rounded-full bg-violet-400/10 blur-2xl" />

      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
          <Brain size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">Planning Agent</h3>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">Built-in</span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">Default AI planner for your projects. Set a user-level prompt that applies across all projects.</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Layers size={11} />
              3 prompt layers: base → user → project
            </span>
          </div>
        </div>

        <button
          onClick={() => setPromptOpen((o) => !o)}
          className="shrink-0 rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
        >
          <motion.span animate={{ rotate: promptOpen ? 180 : 0 }} transition={{ duration: 0.15 }} className="block">
            <ChevronDown size={15} />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {promptOpen && (
          <motion.div
            key="prompt"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">

              {/* ── Model Provider Config ── */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Model Provider</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700">Provider</label>
                    <Select value={provider} onValueChange={(v) => handleProviderChange(v ?? '')}>
                      <SelectTrigger className="h-8 text-sm w-full"><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {LLM_PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700">Model</label>
                    <Input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. claude-sonnet-4-6"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700">
                    API Key
                    {config.hasApiKey && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                        <KeyRound size={9} /> Saved
                      </span>
                    )}
                    <span className="ml-1.5 font-normal text-zinc-400">— leave blank to use workspace key</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={config.hasApiKey ? 'Enter new key to replace…' : 'sk-…'}
                      className="h-8 text-sm pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!providerDirty || updateConfig.isPending}
                    onClick={saveProviderConfig}
                  >
                    {updateConfig.isPending ? 'Saving…' : 'Save provider'}
                  </Button>
                </div>
              </div>

              {/* ── Prompt Config ── */}
              <div className="space-y-3">
                {/* Prompt hierarchy legend */}
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">Base</span>
                  <span>+</span>
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-violet-600">User (this)</span>
                  <span>+</span>
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-sky-600">Project (per-project settings)</span>
                </div>

                {/* Base prompt */}
                <details className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-zinc-400 select-none">
                    Base prompt (readonly)
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-zinc-400 leading-relaxed">{config.basePrompt}</pre>
                </details>

                {/* User-level default prompt */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-700">
                    User-level default prompt
                    <span className="ml-1.5 font-normal text-zinc-400">— appended after base, before project prompt</span>
                  </label>
                  <Textarea
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    placeholder="e.g. 'Always assign at least one QA task per feature. Use conventional commits.'"
                    rows={4}
                    className="resize-none font-mono text-sm"
                    maxLength={8000}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{draftPrompt.length}/8000</span>
                    <Button size="sm" disabled={!isDirty || updateConfig.isPending} onClick={savePrompt}>
                      {updateConfig.isPending ? 'Saving…' : 'Save prompt'}
                    </Button>
                  </div>
                  {updateConfig.isError && (
                    <p className="text-xs text-red-500">{(updateConfig.error as any)?.response?.data?.message ?? 'Failed to save'}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyAgentsPage() {
  const [creating, setCreating] = useState(false);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['my-agents'],
    queryFn: myAgentsApi.list,
  });

  const { data: planningConfig, isLoading: planningLoading } = useQuery({
    queryKey: ['planning-agent-config'],
    queryFn: planningAgentApi.getConfig,
  });

  return (
    <div className="min-h-full p-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Agents</h1>
          <p className="mt-1 text-sm text-zinc-500">Personal AI agents you can deploy to any project.</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1.5" />
            New agent
          </Button>
        )}
      </motion.div>

      {creating && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Create Agent</CardTitle></CardHeader>
            <CardContent>
              <AgentForm onClose={() => setCreating(false)} onSuccess={() => setCreating(false)} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Planning Agent */}
      <div className="mb-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Planning Agent</p>
        {planningLoading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-200" />
        ) : planningConfig ? (
          <PlanningAgentCard config={planningConfig} />
        ) : null}
      </div>

      {/* Personal Agents */}
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Personal Agents</p>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
      ) : agents.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600">
            <Bot size={26} className="text-white" />
          </div>
          <p className="font-semibold text-zinc-700">No agents yet</p>
          <p className="mt-1 text-sm text-zinc-400">Create your first personal AI agent to get started.</p>
          <Button className="mt-6" onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1.5" />
            New agent
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25, ease: 'easeOut' }}
            >
              <AgentCard agent={agent} index={i} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
