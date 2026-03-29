'use client';

import { use, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { projectsApi, keysApi, marketplaceApi, plannerApi, planningAgentApi, agentRunsApi, skillsApi, mcpsApi, tasksApi, myAgentsApi } from '@/lib/api';
import type { UpdatePersonalAgentDto } from '@/lib/api';
import type { ProjectPlanningAgent, PlanningAgentVersion, Skill, Mcp } from '@/lib/api';
import type { ProjectAgent, ResourceKey, AgentRunLog, AgentRunStep, PlannerRunLog } from '@openworkspace/api-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Bot, User, KeyRound, ShieldCheck, ShieldAlert,
  Trash2, Plus, Eye, EyeOff, Copy, Check, Star, Sparkles, Play, CheckCheck, X,
  Brain, RotateCcw, ChevronDown, ChevronRight, Coins, BookOpen, ScrollText, Recycle, Settings2, Box,
} from 'lucide-react';

// ─── Run status colours ──────────────────────────────────────────────────────
const RUN_STATUS_COLOR: Record<string, string> = {
  RUNNING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  STOPPED: 'bg-zinc-100 text-zinc-600',
  FAILED: 'bg-red-100 text-red-600',
  MAX_ITERATIONS: 'bg-yellow-100 text-yellow-700',
};

// ─── Single run entry (collapsible) ─────────────────────────────────────────
function RunEntry({ run }: { run: AgentRunLog & { task?: { id: string; title: string; status: string } } }) {
  const [open, setOpen] = useState(false);
  const totalTokens = (run.totalInputTokens ?? 0) + (run.totalOutputTokens ?? 0);

  return (
    <div className="rounded-lg border border-zinc-100 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown size={13} className="shrink-0 text-zinc-400" /> : <ChevronRight size={13} className="shrink-0 text-zinc-400" />}
        <span className={`shrink-0 rounded text-[10px] font-semibold px-1.5 py-0.5 ${RUN_STATUS_COLOR[run.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
          {run.status}
        </span>
        {run.task && (
          <span className="flex-1 truncate text-xs text-zinc-700 font-medium">{run.task.title}</span>
        )}
        <span className="shrink-0 text-xs text-zinc-400">{run.iterations} iter</span>
        {totalTokens > 0 && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] text-zinc-400">
            <Coins size={9} />{totalTokens.toLocaleString()} tok
          </span>
        )}
        <span className="shrink-0 text-[10px] text-zinc-300">{new Date(run.startedAt).toLocaleString()}</span>
      </button>

      {open && (
        <div className="border-t border-zinc-50 px-3 pb-3 pt-2 space-y-1.5 max-h-80 overflow-y-auto">
          {(run.log as AgentRunStep[]).length === 0 && (
            <p className="text-xs text-zinc-300">No steps logged</p>
          )}
          {(run.log as AgentRunStep[]).map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="shrink-0 rounded px-1 py-0.5 font-mono font-medium bg-zinc-50 text-zinc-500">
                #{step.iteration}
              </span>
              <div className="flex-1 overflow-x-auto space-y-0.5">
                {(step.input_tokens != null || step.context_messages != null) && (
                  <div className="flex items-center gap-2 text-[9px] text-zinc-400">
                    {step.input_tokens != null && (
                      <span className="flex items-center gap-0.5">
                        <Coins size={8} />{step.input_tokens.toLocaleString()} in / {(step.output_tokens ?? 0).toLocaleString()} out
                      </span>
                    )}
                    {step.context_messages != null && (
                      <span className="flex items-center gap-0.5">
                        <BookOpen size={8} />{step.context_messages} msgs
                      </span>
                    )}
                  </div>
                )}
                {step.error && (
                  <pre className="whitespace-pre-wrap text-red-600 font-mono text-[10px] bg-red-50 rounded px-1.5 py-1">{step.error}</pre>
                )}
                {step.llm_content && (
                  <p className="text-zinc-600 text-[10px]">{step.llm_content}</p>
                )}
                {step.tool_calls?.map((tc, j) => (
                  <div key={j} className="rounded bg-purple-50 px-1.5 py-1 text-purple-700">
                    <span className="font-semibold text-[10px]">{tc.name}</span>
                    <pre className="mt-0.5 whitespace-pre-wrap text-[9px] text-purple-500">{JSON.stringify(tc.arguments, null, 2)}</pre>
                    <pre className="mt-0.5 whitespace-pre-wrap text-[9px] text-green-600">{tc.result}</pre>
                  </div>
                ))}
              </div>
              <span className="shrink-0 text-zinc-300">{new Date(step.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agent Log Drawer ────────────────────────────────────────────────────────
function AgentLogDrawer({
  agent,
  projectId,
  onClose,
}: {
  agent: ProjectAgent;
  projectId: string;
  onClose: () => void;
}) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['agent-runs', projectId, agent.id],
    queryFn: () => agentRunsApi.listByAgent(projectId, agent.id),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.status === 'RUNNING') ? 3000 : false,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const totalRuns = runs.length;
  const totalTokens = runs.reduce((s, r) => s + (r.totalInputTokens ?? 0) + (r.totalOutputTokens ?? 0), 0);
  const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
  const runningRun = runs.find((r) => r.status === 'RUNNING');

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            {agent.agent?.type === 'AI' ? <Bot size={17} /> : <User size={17} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-900 truncate">{agent.agent?.name}</p>
            <p className="text-xs text-zinc-400">{agent.role}{agent.agent?.provider?.displayName ? ` · ${agent.agent.provider.displayName}` : ''}</p>
          </div>
          {runningRun && (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Running
            </span>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X size={16} />
          </button>
        </div>

        {/* Stats bar */}
        {totalRuns > 0 && (
          <div className="flex items-center gap-6 border-b border-zinc-100 px-6 py-3 text-sm">
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-900">{totalRuns}</p>
              <p className="text-[11px] text-zinc-400">Total runs</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-900">{totalTokens.toLocaleString()}</p>
              <p className="text-[11px] text-zinc-400">Tokens used</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${failedRuns > 0 ? 'text-red-600' : 'text-zinc-900'}`}>{failedRuns}</p>
              <p className="text-[11px] text-zinc-400">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-900">
                {runs.reduce((s, r) => s + r.iterations, 0)}
              </p>
              <p className="text-[11px] text-zinc-400">Total iterations</p>
            </div>
          </div>
        )}

        {/* Run list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ScrollText size={28} className="mb-3 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No runs yet</p>
              <p className="mt-1 text-xs text-zinc-400">Assign this agent to a task and set it to TODO to trigger a run.</p>
            </div>
          ) : (
            runs.map((run) => <RunEntry key={run.id} run={run} />)
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}


// ─── Planner Log Drawer ───────────────────────────────────────────────────────
function PlannerLogDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['planner-runs', projectId],
    queryFn: () => plannerApi.getRuns(projectId),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalTokens = runs.reduce((s, r) => s + r.totalInputTokens + r.totalOutputTokens, 0);
  const failedCount = runs.filter((r) => r.status === 'FAILED').length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <Brain size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-900">Planning Agent</p>
            <p className="text-xs text-zinc-400">Planner run history</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X size={16} />
          </button>
        </div>

        {/* Stats bar */}
        {runs.length > 0 && (
          <div className="flex items-center gap-6 border-b border-zinc-100 px-6 py-3">
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-900">{runs.length}</p>
              <p className="text-[11px] text-zinc-400">Total runs</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-900">{totalTokens.toLocaleString()}</p>
              <p className="text-[11px] text-zinc-400">Tokens used</p>
            </div>
            {failedCount > 0 && (
              <div className="text-center">
                <p className="text-lg font-bold text-red-500">{failedCount}</p>
                <p className="text-[11px] text-zinc-400">Failed</p>
              </div>
            )}
          </div>
        )}

        {/* Run list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-sm text-zinc-400 gap-2">
              <ScrollText size={28} className="text-zinc-200" />
              No planner runs yet. Click "Run planner" to generate a plan.
            </div>
          ) : runs.map((run) => {
            const isOpen = expandedId === run.id;
            const totalTok = run.totalInputTokens + run.totalOutputTokens;
            return (
              <div key={run.id} className="rounded-lg border border-zinc-100 bg-white">
                <button
                  onClick={() => setExpandedId(isOpen ? null : run.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  {isOpen ? <ChevronDown size={13} className="shrink-0 text-zinc-400" /> : <ChevronRight size={13} className="shrink-0 text-zinc-400" />}
                  <span className={`shrink-0 rounded text-[10px] font-semibold px-1.5 py-0.5 ${run.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {run.status}
                  </span>
                  <span className="flex-1 text-xs text-zinc-500">{new Date(run.startedAt).toLocaleString()}</span>
                  {totalTok > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Coins size={11} /> {totalTok.toLocaleString()}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-50 px-3 pb-3 pt-2 space-y-3">
                    {run.error && (
                      <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 font-mono">
                        {run.error}
                      </div>
                    )}
                    {run.descriptionSnapshot && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Description used</p>
                        <p className="text-xs text-zinc-600 whitespace-pre-wrap line-clamp-4">{run.descriptionSnapshot}</p>
                      </div>
                    )}
                    {run.planOutput && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          Generated plan — {run.planOutput.roles?.length ?? 0} roles · {run.planOutput.tasks?.length ?? 0} tasks
                        </p>
                        <div className="space-y-1">
                          {run.planOutput.tasks?.slice(0, 8).map((t, i) => (
                            <div key={i} className="flex items-center gap-2 rounded bg-zinc-50 px-2 py-1.5">
                              <span className="text-xs font-medium text-zinc-800 flex-1 truncate">{t.title}</span>
                              <span className="text-[10px] text-zinc-400">{t.role}</span>
                              {t.priority && (
                                <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                                  t.priority === 'HIGH' || t.priority === 'URGENT' ? 'bg-red-50 text-red-600' :
                                  t.priority === 'MEDIUM' ? 'bg-yellow-50 text-yellow-600' : 'bg-zinc-100 text-zinc-500'
                                }`}>{t.priority}</span>
                              )}
                            </div>
                          ))}
                          {(run.planOutput.tasks?.length ?? 0) > 8 && (
                            <p className="text-[11px] text-zinc-400 pl-2">+{run.planOutput.tasks!.length - 8} more tasks</p>
                          )}
                        </div>
                      </div>
                    )}
                    {(run.totalInputTokens > 0 || run.totalOutputTokens > 0) && (
                      <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                        <span>{run.totalInputTokens.toLocaleString()} in</span>
                        <span>{run.totalOutputTokens.toLocaleString()} out</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Skills & MCPs panel for a project agent ─────────────────────────────────
function ProjectAgentCapabilities({ projectId, projectAgentId }: { projectId: string; projectAgentId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'skills' | 'mcps'>('skills');

  const { data: assignedSkills = [] } = useQuery({
    queryKey: ['pa-skills', projectAgentId],
    queryFn: () => skillsApi.listForProjectAgent(projectId, projectAgentId),
  });
  const { data: assignedMcps = [] } = useQuery({
    queryKey: ['pa-mcps', projectAgentId],
    queryFn: () => mcpsApi.listForProjectAgent(projectId, projectAgentId),
  });
  const { data: allSkills = [] } = useQuery({ queryKey: ['my-skills'], queryFn: skillsApi.list });
  const { data: allMcps = [] } = useQuery({ queryKey: ['my-mcps'], queryFn: mcpsApi.list });

  const assignedSkillIds = new Set(assignedSkills.map((s) => s.skill.id));
  const assignedMcpIds = new Set(assignedMcps.map((m) => m.mcp.id));

  const assignSkill = useMutation({
    mutationFn: (skillId: string) => skillsApi.assignToProjectAgent(projectId, projectAgentId, skillId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-skills', projectAgentId] }),
  });
  const removeSkill = useMutation({
    mutationFn: (skillId: string) => skillsApi.removeFromProjectAgent(projectId, projectAgentId, skillId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-skills', projectAgentId] }),
  });
  const assignMcp = useMutation({
    mutationFn: (mcpId: string) => mcpsApi.assignToProjectAgent(projectId, projectAgentId, mcpId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-mcps', projectAgentId] }),
  });
  const removeMcp = useMutation({
    mutationFn: (mcpId: string) => mcpsApi.removeFromProjectAgent(projectId, projectAgentId, mcpId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-mcps', projectAgentId] }),
  });

  return (
    <div className="border-t border-zinc-100 pt-3 mt-1">
      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        {(['skills', 'mcps'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === t ? 'bg-violet-100 text-violet-700' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t === 'skills' ? `Skills (${assignedSkillIds.size})` : `MCPs (${assignedMcpIds.size})`}
          </button>
        ))}
      </div>

      {tab === 'skills' && (
        <div className="space-y-1.5">
          {allSkills.length === 0 ? (
            <p className="text-xs text-zinc-400">No skills created yet. Create skills in the Skills page.</p>
          ) : allSkills.map((skill) => {
            const assigned = assignedSkillIds.has(skill.id);
            return (
              <div key={skill.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-800 truncate">{skill.name}</p>
                  <p className="text-[10px] text-zinc-400">{skill.type}</p>
                </div>
                <button
                  onClick={() => assigned ? removeSkill.mutate(skill.id) : assignSkill.mutate(skill.id)}
                  disabled={assignSkill.isPending || removeSkill.isPending}
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                    assigned
                      ? 'bg-violet-100 text-violet-700 hover:bg-red-50 hover:text-red-600'
                      : 'bg-zinc-200 text-zinc-600 hover:bg-violet-100 hover:text-violet-700'
                  }`}
                >
                  {assigned ? 'Remove' : 'Assign'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'mcps' && (
        <div className="space-y-1.5">
          {allMcps.length === 0 ? (
            <p className="text-xs text-zinc-400">No MCPs created yet. Create MCPs in the MCPs page.</p>
          ) : allMcps.map((mcp) => {
            const assigned = assignedMcpIds.has(mcp.id);
            return (
              <div key={mcp.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-800 truncate">{mcp.name}</p>
                  <p className="text-[10px] text-zinc-400">{mcp.transport}</p>
                </div>
                <button
                  onClick={() => assigned ? removeMcp.mutate(mcp.id) : assignMcp.mutate(mcp.id)}
                  disabled={assignMcp.isPending || removeMcp.isPending}
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                    assigned
                      ? 'bg-violet-100 text-violet-700 hover:bg-red-50 hover:text-red-600'
                      : 'bg-zinc-200 text-zinc-600 hover:bg-violet-100 hover:text-violet-700'
                  }`}
                >
                  {assigned ? 'Remove' : 'Assign'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopiedBadge() {
  return <span className="text-xs text-green-600 flex items-center gap-1"><Check size={11} /> Copied</span>;
}

// ─── Agent Config Editor ─────────────────────────────────────────────────────

const LLM_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'custom', label: 'Custom' },
];
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o', gemini: 'gemini-2.0-flash', custom: '',
};

function AgentConfigEditor({ agent, onClose }: { agent: ProjectAgent; onClose: () => void }) {
  const qc = useQueryClient();
  const a = agent.agent!;
  const [provider, setProvider] = useState<string>((a as any).llmProvider ?? 'anthropic');
  const [model, setModel] = useState<string>((a as any).modelName ?? '');
  const [systemPrompt, setSystemPrompt] = useState<string>((a as any).systemPrompt ?? '');
  const [temperature, setTemperature] = useState<string>((a as any).temperature?.toString() ?? '0.7');
  const [maxTokens, setMaxTokens] = useState<string>((a as any).maxTokens?.toString() ?? '');
  const [maxIterations, setMaxIterations] = useState<string>((a as any).maxIterations?.toString() ?? '20');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const dto: UpdatePersonalAgentDto = {
        llmProvider: provider,
        modelName: model,
        systemPrompt: systemPrompt || undefined,
        temperature: temperature ? Number(temperature) : undefined,
        maxTokens: maxTokens ? Number(maxTokens) : undefined,
        maxIterations: maxIterations ? Number(maxIterations) : undefined,
        apiKey: apiKey || undefined,
      };
      return myAgentsApi.update(a.id, dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-agents'] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to save'),
  });

  return (
    <div className="border-t border-zinc-100 pt-4 mt-1 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Provider</Label>
          <select
            value={provider}
            onChange={(e) => { setProvider(e.target.value); setModel(DEFAULT_MODELS[e.target.value] ?? ''); }}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
          >
            {LLM_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} className="h-8 text-sm" placeholder="e.g. claude-sonnet-4-6" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">System Prompt</Label>
        <Textarea
          rows={4}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful AI assistant…"
          className="text-sm resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Temperature</Label>
          <Input value={temperature} onChange={(e) => setTemperature(e.target.value)} className="h-8 text-sm" placeholder="0.7" type="number" step="0.1" min="0" max="2" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max Tokens</Label>
          <Input value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} className="h-8 text-sm" placeholder="4096" type="number" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max Iterations</Label>
          <Input value={maxIterations} onChange={(e) => setMaxIterations(e.target.value)} className="h-8 text-sm" placeholder="20" type="number" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">API Key Override <span className="text-zinc-400">(leave blank to keep current)</span></Label>
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-8 text-sm pr-8"
            placeholder="sk-…"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save config'}
        </Button>
      </div>
    </div>
  );
}

// ─── Recycle Bin Drawer ───────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-600',
  HIGH: 'bg-orange-50 text-orange-600',
  MEDIUM: 'bg-yellow-50 text-yellow-600',
  LOW: 'bg-zinc-100 text-zinc-500',
};

function RecycleBinDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data: deleted = [], isLoading } = useQuery({
    queryKey: ['tasks-deleted', projectId],
    queryFn: () => tasksApi.listDeleted(projectId),
  });

  const restore = useMutation({
    mutationFn: (taskId: string) => tasksApi.restore(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-deleted', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const permanentlyDelete = useMutation({
    mutationFn: (taskId: string) => tasksApi.permanentlyDelete(projectId, taskId),
    onSuccess: () => {
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ['tasks-deleted', projectId] });
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Recycle size={16} className="text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900">Recycle Bin</h2>
            {deleted.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">{deleted.length}</span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-zinc-100 animate-pulse" />)}
            </div>
          )}
          {!isLoading && deleted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Recycle size={32} className="mb-3 text-zinc-200" />
              <p className="text-sm text-zinc-400">Recycle bin is empty</p>
            </div>
          )}
          {deleted.map((task) => (
            <div key={task.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-700 truncate">{task.title}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLOR[task.priority] ?? 'bg-zinc-100 text-zinc-500'}`}>
                      {task.priority}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Deleted {new Date(task.deletedAt!).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => restore.mutate(task.id)}
                    disabled={restore.isPending}
                    className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                    title="Restore task"
                  >
                    Restore
                  </button>
                  {confirmId === task.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => permanentlyDelete.mutate(task.id)}
                        disabled={permanentlyDelete.isPending}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {permanentlyDelete.isPending ? '…' : 'Delete'}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(task.id)}
                      className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Permanently delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = use(params);
  const locale = useLocale();
  const qc = useQueryClient();

  // Keys form state
  const [showAddKey, setShowAddKey] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyDesc, setKeyDesc] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [showKeyValue, setShowKeyValue] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Agreement form state (human agents)
  const [signingId, setSigningId] = useState<string | null>(null);
  const [sigRef, setSigRef] = useState('');

  // Review state
  const [reviewingAgentId, setReviewingAgentId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Description state
  const [description, setDescription] = useState('');
  const [descDirty, setDescDirty] = useState(false);

  // Agent log drawer
  const [selectedAgent, setSelectedAgent] = useState<ProjectAgent | null>(null);
  const [showPlannerLogs, setShowPlannerLogs] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [configOpenId, setConfigOpenId] = useState<string | null>(null);
  const [capabilitiesOpenId, setCapabilitiesOpenId] = useState<string | null>(null);

  // Planner state
  const [plannerAgentId, setPlannerAgentId] = useState<string>('');
  const [planDraft, setPlanDraft] = useState<{
    roles: Array<{ name: string; description?: string }>;
    tasks: Array<{ title: string; role: string; priority?: string; description?: string; dependencies?: string[] }>;
  } | null>(null);
  const [taskAssignees, setTaskAssignees] = useState<Record<number, string>>({}); // task index → projectAgentId
  const [replaceExisting, setReplaceExisting] = useState(true);

  // Planning Agent state
  const [draftPrompt, setDraftPrompt] = useState('');
  const [publishLabel, setPublishLabel] = useState('');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery<ProjectAgent[]>({
    queryKey: ['project-agents', projectId],
    queryFn: () => projectsApi.listAgents(projectId),
  });

  const { data: keys = [], isLoading: keysLoading } = useQuery<ResourceKey[]>({
    queryKey: ['keys', projectId],
    queryFn: () => keysApi.list(projectId),
  });

  const { data: planningAgent, isLoading: planningAgentLoading } = useQuery<ProjectPlanningAgent>({
    queryKey: ['planning-agent', projectId],
    queryFn: () => planningAgentApi.get(projectId),
  });

  useEffect(() => {
    if (project && !descDirty) setDescription(project.description ?? '');
  }, [project?.description]);

  useEffect(() => {
    if (planningAgent?.customPrompt !== undefined) {
      setDraftPrompt(planningAgent.customPrompt ?? '');
    }
  }, [planningAgent?.customPrompt]);

  const updateDescription = useMutation({
    mutationFn: () => projectsApi.update(projectId, { description }),
    onSuccess: async () => {
      setDescDirty(false);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      // Auto-run planner if one is configured
      if (project?.plannerProjectAgentId || true) {
        try {
          const draft = await plannerApi.runPlanner(projectId);
          setPlanDraft(draft);
          setTaskAssignees({});
          setReplaceExisting(true);
        } catch {
          // Planner not configured or failed — silent
        }
      }
    },
  });

  const removeAgent = useMutation({
    mutationFn: (projectAgentId: string) => projectsApi.removeAgent(projectId, projectAgentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-agents', projectId] }),
  });

  const updateSandboxProvider = useMutation({
    mutationFn: (provider: string | null) => projectsApi.update(projectId, { sandboxProvider: provider } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const acceptAgreement = useMutation({
    mutationFn: ({ projectAgentId, signatureRef }: { projectAgentId: string; signatureRef?: string }) =>
      projectsApi.acceptAgreement(projectId, projectAgentId, { signatureRef }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-agents', projectId] });
      setSigningId(null);
      setSigRef('');
    },
  });

  const createKey = useMutation({
    mutationFn: () => keysApi.create(projectId, { name: keyName, description: keyDesc || undefined, value: keyValue }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys', projectId] });
      setShowAddKey(false);
      setKeyName('');
      setKeyDesc('');
      setKeyValue('');
    },
  });

  const deleteKey = useMutation({
    mutationFn: (keyId: string) => keysApi.delete(projectId, keyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keys', projectId] }),
  });

  const submitReview = useMutation({
    mutationFn: (agentId: string) =>
      marketplaceApi.createReview(agentId, projectId, { rating: reviewRating, comment: reviewComment || undefined }),
    onSuccess: () => {
      setReviewingAgentId(null);
      setReviewRating(5);
      setReviewComment('');
    },
  });

  const setPlanner = useMutation({
    mutationFn: (paId: string) => plannerApi.setPlanner(projectId, { projectAgentId: paId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const runPlanner = useMutation({
    mutationFn: () => plannerApi.runPlanner(projectId),
    onSuccess: (data) => { setPlanDraft(data); setTaskAssignees({}); },
  });

  const acceptPlan = useMutation({
    mutationFn: () => {
      const tasks = planDraft!.tasks.map((t, i) => ({
        ...t,
        assigneeId: taskAssignees[i] ?? roleAgentMap.get(t.role.toLowerCase()),
      }));
      return plannerApi.acceptPlan(projectId, { roles: planDraft!.roles, tasks, replaceExisting });
    },
    onSuccess: () => {
      setPlanDraft(null);
      setTaskAssignees({});
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updatePrompt = useMutation({
    mutationFn: () => planningAgentApi.updatePrompt(projectId, draftPrompt),
    onSuccess: (data) => qc.setQueryData(['planning-agent', projectId], data),
  });

  const publishVersion = useMutation({
    mutationFn: () => planningAgentApi.publishVersion(projectId, publishLabel || undefined),
    onSuccess: (data) => {
      qc.setQueryData(['planning-agent', projectId], data);
      setPublishLabel('');
    },
  });

  const deleteVersion = useMutation({
    mutationFn: (versionId: string) => planningAgentApi.deleteVersion(projectId, versionId),
    onSuccess: (data) => qc.setQueryData(['planning-agent', projectId], data),
  });

  const activateVersion = useMutation({
    mutationFn: (versionId: string | null) => planningAgentApi.activateVersion(projectId, versionId),
    onSuccess: (data) => qc.setQueryData(['planning-agent', projectId], data),
  });

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const activeAgents = agents.filter((a) => !a.revokedAt);
  const aiAgents = activeAgents.filter((a) => (a as any).agent?.type === 'AI');

  // Build role → projectAgentId map (same logic as backend) for auto-matching display
  const roleAgentMap = new Map<string, string>(); // role lowercase → projectAgentId
  for (const pa of aiAgents) {
    const key = ((pa.customRole ?? pa.role) as string).toLowerCase();
    if (!roleAgentMap.has(key)) roleAgentMap.set(key, pa.id);
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/${locale}/workspaces/${slug}/projects/${projectId}/board`}
          className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700"
        >
          <ArrowLeft size={14} /> Back to board
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{project?.name ?? '…'}</h1>
            <p className="mt-1 text-sm text-zinc-500">Project settings</p>
          </div>
          <button
            onClick={() => setShowRecycleBin(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
            title="Recycle bin"
          >
            <Recycle size={14} />
            Recycle bin
          </button>
        </div>
      </div>

      {/* ── Project Description ─────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Project Description</h2>
            <p className="text-sm text-zinc-400">Describe the project goals. Saving will automatically re-run the planner and propose updated tasks.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Textarea
            rows={5}
            placeholder="Describe what this project is building, its goals, tech stack, and any constraints…"
            className="resize-none text-sm"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDescDirty(true); }}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              {updateDescription.isPending && (
                <span className="flex items-center gap-1.5 text-violet-600">
                  <Sparkles size={11} className="animate-pulse" /> Running planner…
                </span>
              )}
            </div>
            <Button
              size="sm"
              disabled={updateDescription.isPending || runPlanner.isPending}
              onClick={() => descDirty ? updateDescription.mutate() : runPlanner.mutate()}
            >
              {(updateDescription.isPending || runPlanner.isPending) ? 'Planning…' : descDirty ? 'Save & re-plan' : 'Plan'}
            </Button>
          </div>
          {updateDescription.isError && (
            <p className="text-xs text-red-500">
              {(updateDescription.error as any)?.response?.data?.message ?? 'Failed to save'}
            </p>
          )}
        </div>
      </section>

      <Separator className="mb-10" />

      {/* ── Agents ───────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Agents</h2>
          <Link
            href={`/${locale}/marketplace`}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
          >
            <Plus size={14} /> Hire from marketplace
          </Link>
        </div>

        {agentsLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : activeAgents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400">
            No agents hired yet
          </div>
        ) : (
          <div className="space-y-3">
            {activeAgents.map((pa) => {
              const agreed = !!pa.agreement;
              const isHuman = pa.agent!.type === 'HUMAN';
              return (
                <Card key={pa.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <button
                      onClick={() => setSelectedAgent(pa)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 shrink-0 hover:bg-zinc-200 transition-colors"
                      title="View run logs"
                    >
                      {pa.agent!.type === 'AI' ? <Bot size={18} /> : <User size={18} />}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedAgent(pa)}>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-900 hover:text-violet-700 transition-colors">{pa.agent!.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{pa.role}</Badge>
                      </div>
                      <p className="text-xs text-zinc-400">{pa.agent!.provider?.displayName}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Agreement status */}
                      {agreed ? (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <ShieldCheck size={13} /> Agreement accepted
                        </div>
                      ) : !isHuman ? (
                        <div className="flex items-center gap-1 text-xs text-zinc-400">
                          <ShieldAlert size={13} /> Awaiting provider
                        </div>
                      ) : signingId === pa.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="DocuSign envelope ID…"
                            className="h-7 w-44 text-xs"
                            value={sigRef}
                            onChange={(e) => setSigRef(e.target.value)}
                          />
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={!sigRef || acceptAgreement.isPending}
                            onClick={() => acceptAgreement.mutate({ projectAgentId: pa.id, signatureRef: sigRef })}
                          >
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSigningId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800"
                          onClick={() => setSigningId(pa.id)}
                        >
                          <ShieldAlert size={13} /> Enter signature ref
                        </button>
                      )}

                      <button
                        onClick={() => setCapabilitiesOpenId(capabilitiesOpenId === pa.id ? null : pa.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                          capabilitiesOpenId === pa.id
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : 'border-zinc-200 text-zinc-500 hover:border-violet-200 hover:text-violet-600'
                        }`}
                        title="Skills & MCPs"
                      >
                        <BookOpen size={12} />
                        Skills & MCPs
                      </button>

                      {!isHuman && (
                        <button
                          onClick={() => setConfigOpenId(configOpenId === pa.id ? null : pa.id)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                            configOpenId === pa.id
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-zinc-200 text-zinc-500 hover:border-blue-200 hover:text-blue-600'
                          }`}
                          title="Edit agent config"
                        >
                          <Settings2 size={12} />
                          Config
                        </button>
                      )}

                      <button
                        onClick={() => removeAgent.mutate(pa.id)}
                        disabled={removeAgent.isPending}
                        className="text-zinc-300 hover:text-red-400"
                        title="Remove agent"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </CardContent>
                  {capabilitiesOpenId === pa.id && (
                    <CardContent className="pt-0 pb-4 px-4">
                      <ProjectAgentCapabilities projectId={projectId} projectAgentId={pa.id} />
                    </CardContent>
                  )}
                  {configOpenId === pa.id && (
                    <CardContent className="pt-0 pb-4 px-4">
                      <AgentConfigEditor agent={pa} onClose={() => setConfigOpenId(null)} />
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Separator className="mb-10" />

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      {activeAgents.filter((a) => a.agreement).length > 0 && (
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">Leave a Review</h2>
            <p className="text-sm text-zinc-400">Rate agents you have worked with on this project.</p>
          </div>
          <div className="space-y-2">
            {activeAgents
              .filter((a) => a.agreement)
              .map((pa) => (
                <div key={pa.id}>
                  {reviewingAgentId === pa.agent!.id ? (
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          {pa.agent!.type === 'AI' ? <Bot size={15} className="text-zinc-400" /> : <User size={15} className="text-zinc-400" />}
                          <p className="text-sm font-medium text-zinc-800">{pa.agent!.name}</p>
                        </div>
                        {/* Star rating */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button key={s} onClick={() => setReviewRating(s)}>
                              <Star
                                size={20}
                                className={s <= reviewRating ? 'text-amber-400' : 'text-zinc-200'}
                                fill={s <= reviewRating ? 'currentColor' : 'none'}
                              />
                            </button>
                          ))}
                          <span className="ml-2 text-sm text-zinc-500">{reviewRating} / 5</span>
                        </div>
                        <Textarea
                          placeholder="Share your experience (optional)…"
                          rows={3}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                        />
                        {submitReview.isError && (
                          <p className="text-xs text-red-500">
                            {(submitReview.error as any)?.response?.data?.message ?? 'Failed to submit review'}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={() => setReviewingAgentId(null)}>Cancel</Button>
                          <Button
                            className="flex-1"
                            disabled={submitReview.isPending}
                            onClick={() => submitReview.mutate(pa.agent!.id)}
                          >
                            {submitReview.isPending ? 'Submitting…' : 'Submit review'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-4 py-3">
                      <div className="flex items-center gap-2">
                        {pa.agent!.type === 'AI' ? <Bot size={15} className="text-zinc-400" /> : <User size={15} className="text-zinc-400" />}
                        <p className="text-sm text-zinc-700">{pa.agent!.name}</p>
                        <span className="text-xs text-zinc-400">{pa.agent!.provider?.displayName}</span>
                      </div>
                      <button
                        onClick={() => { setReviewingAgentId(pa.agent!.id); setReviewRating(5); setReviewComment(''); }}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-500"
                      >
                        <Star size={13} /> Write review
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {activeAgents.filter((a) => a.agreement).length > 0 && <Separator className="mb-10" />}

      {/* ── Planner ───────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Planner Agent</h2>
          <p className="text-sm text-zinc-400">
            Assign an AI agent to plan the project: it will generate roles and tasks from your project description.
          </p>
        </div>

        {/* Set planner */}
        <Card className="mb-4">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <select
                className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm bg-white"
                value={plannerAgentId || project?.plannerProjectAgentId || ''}
                onChange={(e) => setPlannerAgentId(e.target.value)}
              >
                <option value="">— Select a hired AI agent —</option>
                {activeAgents
                  .filter((a) => a.agent?.type === 'AI')
                  .map((pa) => (
                    <option key={pa.id} value={pa.id}>{pa.agent!.name} ({pa.role})</option>
                  ))}
              </select>
              <Button
                size="sm"
                disabled={!plannerAgentId || setPlanner.isPending}
                onClick={() => setPlanner.mutate(plannerAgentId)}
              >
                {setPlanner.isPending ? 'Saving…' : 'Set planner'}
              </Button>
            </div>
            {project?.plannerProjectAgentId && (() => {
              const plannerPa = activeAgents.find((a) => a.id === project.plannerProjectAgentId);
              return (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCheck size={12} /> Planner assigned
                    {plannerPa && <span className="text-zinc-500 ml-1">— {plannerPa.agent?.name}</span>}
                  </p>
                  {plannerPa && (
                    <button
                      onClick={() => setSelectedAgent(plannerPa)}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
                    >
                      <ScrollText size={12} /> View logs
                    </button>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Run planner */}
        {project?.plannerProjectAgentId && !planDraft && (
          <Button
            variant="outline"
            onClick={() => runPlanner.mutate()}
            disabled={runPlanner.isPending}
          >
            <Sparkles size={14} className="mr-1.5" />
            {runPlanner.isPending ? 'Planning…' : 'Run planner'}
          </Button>
        )}

        {runPlanner.isError && (
          <p className="mt-2 text-xs text-red-500">
            {(runPlanner.error as any)?.response?.data?.message ?? 'Planner failed'}
          </p>
        )}

        {/* Plan draft review */}
        {planDraft && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">Review proposed plan</p>
              <button onClick={() => { setPlanDraft(null); setTaskAssignees({}); }} className="text-zinc-400 hover:text-zinc-700">
                <X size={16} />
              </button>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-400 tracking-wide">Roles</p>
              <div className="space-y-1">
                {planDraft.roles.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="font-medium text-zinc-800">{r.name}</span>
                    {r.description && <span className="text-zinc-400">— {r.description}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-400 tracking-wide">Tasks ({planDraft.tasks.length})</p>
              <div className="space-y-1.5">
                {planDraft.tasks.map((t, i) => {
                  const autoAssigneeId = roleAgentMap.get(t.role.toLowerCase());
                  const assigneeId = taskAssignees[i] ?? autoAssigneeId;
                  const assigneePa = activeAgents.find((a) => a.id === assigneeId);
                  const assigneeName = assigneePa
                    ? ((assigneePa as any).agent?.name ?? assigneePa.customRole ?? assigneePa.role)
                    : null;
                  return (
                    <div key={i} className={`rounded-lg bg-white border px-3 py-2 ${assigneeId ? 'border-zinc-100' : 'border-red-200 bg-red-50/30'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-900">{t.title}</span>
                        <span className="text-xs text-zinc-400">→ {t.role}</span>
                        {t.priority && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            t.priority === 'HIGH' || t.priority === 'URGENT' ? 'bg-red-50 text-red-600' :
                            t.priority === 'MEDIUM' ? 'bg-yellow-50 text-yellow-600' : 'bg-zinc-100 text-zinc-500'
                          }`}>{t.priority}</span>
                        )}
                        <div className="ml-auto flex items-center gap-1.5">
                          {assigneeName && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium flex items-center gap-1">
                              <Bot size={10} />
                              {assigneeName}
                            </span>
                          )}
                          <select
                            value={taskAssignees[i] ?? autoAssigneeId ?? ''}
                            onChange={(e) => setTaskAssignees((prev) => ({ ...prev, [i]: e.target.value }))}
                            className={`text-xs border rounded px-1.5 py-0.5 bg-white focus:outline-none ${assigneeId ? 'border-zinc-200 text-zinc-500' : 'border-red-300 text-red-500'}`}
                          >
                            <option value="">— assign agent —</option>
                            {activeAgents.map((pa) => (
                              <option key={pa.id} value={pa.id}>
                                {(pa as any).agent?.name ?? pa.customRole ?? pa.role}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              setPlanDraft((prev) => prev ? { ...prev, tasks: prev.tasks.filter((_, j) => j !== i) } : prev);
                              setTaskAssignees((prev) => {
                                const next: Record<number, string> = {};
                                Object.entries(prev).forEach(([k, v]) => {
                                  const ki = Number(k);
                                  if (ki < i) next[ki] = v;
                                  else if (ki > i) next[ki - 1] = v;
                                });
                                return next;
                              });
                            }}
                            className="ml-1 text-zinc-300 hover:text-red-400 transition-colors"
                            title="Remove task"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                      {t.description && <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>}
                      {(t.dependencies ?? []).length > 0 && (
                        <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-zinc-400">
                          <span className="font-medium">Blocked by:</span>
                          {t.dependencies!.map((dep, d) => (
                            <span key={d} className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 font-medium">{dep}</span>
                          ))}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {planDraft.tasks.some((t, i) => !(taskAssignees[i] ?? roleAgentMap.get(t.role.toLowerCase()))) && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  All tasks must be assigned before you can apply the plan.
                </p>
              )}
            </div>

            {/* Replace vs append toggle */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
              <p className="text-xs font-semibold text-zinc-600">How to apply these tasks?</p>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={replaceExisting}
                    onChange={() => setReplaceExisting(true)}
                    className="accent-zinc-800"
                  />
                  <span className="text-sm text-zinc-700">Replace existing Backlog tasks</span>
                  <span className="text-xs text-zinc-400">— removes current backlog, adds new plan</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!replaceExisting}
                    onChange={() => setReplaceExisting(false)}
                    className="accent-zinc-800"
                  />
                  <span className="text-sm text-zinc-700">Append to board</span>
                  <span className="text-xs text-zinc-400">— keeps existing tasks, adds new ones</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setPlanDraft(null); setTaskAssignees({}); }}>
                Discard
              </Button>
              <Button
                className="flex-1"
                disabled={acceptPlan.isPending || planDraft.tasks.some((t, i) => !(taskAssignees[i] ?? roleAgentMap.get(t.role.toLowerCase())))}
                onClick={() => acceptPlan.mutate()}
              >
                <Play size={13} className="mr-1.5" />
                {acceptPlan.isPending ? 'Applying…' : 'Accept & apply'}
              </Button>
            </div>
          </div>
        )}
      </section>

      <Separator className="mb-10" />

      {/* ── Planning Agent ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
              <Brain size={18} className="text-violet-500" />
              Planning Agent
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              A built-in AI planner for this project. Customize its behaviour and publish up to 3 versions.
            </p>
          </div>
          <button
            onClick={() => setShowPlannerLogs(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:border-violet-300 hover:text-violet-700 transition-colors"
          >
            <ScrollText size={13} /> View logs
          </button>
        </div>

        {planningAgentLoading ? (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        ) : planningAgent && (
          <div className="space-y-4">
            {/* Base prompt (readonly) */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Base Prompt (readonly)</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-400 leading-relaxed">{planningAgent.basePrompt}</pre>
            </div>

            {/* Custom prompt */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-600">Custom Prompt (appended)</span>
              </div>
              <Textarea
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                placeholder="Add project-specific instructions… e.g. 'This is a React/TypeScript project. Always assign frontend tasks to DEVELOPER role.'"
                rows={5}
                className="resize-none font-mono text-sm"
                maxLength={8000}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{draftPrompt.length}/8000</span>
                <Button
                  size="sm"
                  disabled={updatePrompt.isPending || draftPrompt === (planningAgent.customPrompt ?? '')}
                  onClick={() => updatePrompt.mutate()}
                >
                  {updatePrompt.isPending ? 'Saving…' : 'Save prompt'}
                </Button>
              </div>
            </div>

            {/* Versions */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900">Published Versions</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{planningAgent.versions.length}/3 versions published</p>
                </div>
                {planningAgent.versions.length < 3 && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Version label (optional)"
                      value={publishLabel}
                      onChange={(e) => setPublishLabel(e.target.value)}
                      className="h-8 w-44 text-sm"
                    />
                    <Button
                      size="sm"
                      disabled={publishVersion.isPending}
                      onClick={() => publishVersion.mutate()}
                    >
                      {publishVersion.isPending ? 'Publishing…' : 'Publish'}
                    </Button>
                  </div>
                )}
              </div>

              {publishVersion.isError && (
                <p className="text-xs text-red-500">{(publishVersion.error as any)?.response?.data?.message ?? 'Failed to publish'}</p>
              )}

              {planningAgent.versions.length === 0 ? (
                <p className="text-sm text-zinc-400">No versions published yet. Save your custom prompt and publish it as a version.</p>
              ) : (
                <div className="space-y-2">
                  {planningAgent.versions.map((v: PlanningAgentVersion) => {
                    const isActive = planningAgent.activeVersionId === v.id;
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${isActive ? 'border-violet-200 bg-violet-50' : 'border-zinc-100 bg-zinc-50'}`}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isActive ? 'bg-violet-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                          v{v.versionNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800">{v.label ?? `Version ${v.versionNumber}`}</p>
                          <p className="text-xs text-zinc-400">Published {new Date(v.publishedAt).toLocaleDateString()}</p>
                        </div>
                        {isActive && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Active</span>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          {isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={activateVersion.isPending}
                              onClick={() => activateVersion.mutate(null)}
                            >
                              <RotateCcw size={11} className="mr-1" /> Use draft
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={activateVersion.isPending}
                              onClick={() => activateVersion.mutate(v.id)}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-zinc-300 hover:text-red-400 hover:bg-red-50"
                            disabled={deleteVersion.isPending}
                            onClick={() => deleteVersion.mutate(v.id)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {planningAgent.activeVersionId === null && (
                <p className="text-xs text-zinc-400 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400" />
                  Currently using draft prompt (no version active)
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <Separator className="mb-10" />

      {/* ── Resource Keys ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Resource Keys</h2>
            <p className="text-sm text-zinc-400">
              Encrypted secrets agents can access (e.g. GitHub tokens, API keys). Values are write-only.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAddKey(true)} disabled={showAddKey}>
            <Plus size={14} className="mr-1.5" /> Add key
          </Button>
        </div>

        {/* Add key form */}
        {showAddKey && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">New resource key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="GitHub Token"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description (optional)</Label>
                  <Input
                    placeholder="Read-only access to main repo"
                    value={keyDesc}
                    onChange={(e) => setKeyDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Secret value</Label>
                <div className="relative">
                  <Input
                    type={showKeyValue ? 'text' : 'password'}
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyValue((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    {showKeyValue ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowAddKey(false); setKeyName(''); setKeyDesc(''); setKeyValue(''); }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!keyName || !keyValue || createKey.isPending}
                  onClick={() => createKey.mutate()}
                >
                  {createKey.isPending ? 'Saving…' : 'Save key'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {keysLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : keys.length === 0 && !showAddKey ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400">
            No keys stored yet
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3"
              >
                <KeyRound size={16} className="shrink-0 text-zinc-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{k.name}</p>
                  {k.description && (
                    <p className="text-xs text-zinc-400 truncate">{k.description}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-300 shrink-0">
                  {new Date(k.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {copiedKeyId === k.id ? (
                    <CopiedBadge />
                  ) : (
                    <span className="text-xs font-mono text-zinc-300">••••••••</span>
                  )}
                  <button
                    onClick={() => deleteKey.mutate(k.id)}
                    disabled={deleteKey.isPending}
                    className="ml-2 text-zinc-300 hover:text-red-400"
                    title="Delete key"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Sandbox ───────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Sandbox</h2>
          <p className="text-sm text-zinc-400">
            Choose the sandbox provider for agent runs in this project.
            Agents use the sandbox to execute code, run builds, and push to Git.
          </p>
        </div>
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 shrink-0">
                <Box size={16} className="text-cyan-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900">Provider</p>
                <p className="text-xs text-zinc-400">
                  Configure the E2B API key in{' '}
                  <Link href={`/${locale}/workspaces/${slug}/settings`} className="text-violet-600 hover:underline">
                    workspace settings
                  </Link>
                </p>
              </div>
              <select
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm bg-white"
                value={project?.sandboxProvider ?? 'none'}
                onChange={(e) => updateSandboxProvider.mutate(e.target.value === 'none' ? null : e.target.value)}
                disabled={updateSandboxProvider.isPending}
              >
                <option value="e2b">E2B (default)</option>
                <option value="none">None — disable sandbox</option>
              </select>
            </div>
            {project?.sandboxProvider === 'e2b' && (
              <p className="text-xs text-zinc-400 bg-cyan-50 rounded-lg px-3 py-2">
                Agents will run in isolated E2B Ubuntu sandboxes with access to shell, git, build tools, and file I/O.
              </p>
            )}
            {!project?.sandboxProvider && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Sandbox disabled — agents can only use HTTP requests and task tools. No code execution.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {selectedAgent && (
        <AgentLogDrawer
          agent={selectedAgent}
          projectId={projectId}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {showPlannerLogs && (
        <PlannerLogDrawer
          projectId={projectId}
          onClose={() => setShowPlannerLogs(false)}
        />
      )}

      {showRecycleBin && (
        <RecycleBinDrawer
          projectId={projectId}
          onClose={() => setShowRecycleBin(false)}
        />
      )}
    </div>
  );
}
