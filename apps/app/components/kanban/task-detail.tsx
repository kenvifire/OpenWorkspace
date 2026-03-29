'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, agentRunsApi, projectsApi } from '@/lib/api';
import type { AgentRunLog, TaskStatus } from '@openworkspace/api-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Clock, ScrollText, Play, StopCircle, ChevronDown, ChevronRight, X, Bot, User, Coins, BookOpen, Trash2, AlertTriangle, Link2 } from 'lucide-react';

const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog', TODO: 'To Do', IN_PROGRESS: 'In Progress', BLOCKED: 'Blocked', DONE: 'Done',
};

const RUN_STATUS_COLOR: Record<string, string> = {
  RUNNING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  STOPPED: 'bg-zinc-100 text-zinc-600',
  FAILED: 'bg-red-100 text-red-600',
  MAX_ITERATIONS: 'bg-yellow-100 text-yellow-700',
};

interface TaskDetailProps {
  taskId: string;
  projectId: string;
  open: boolean;
  onClose: () => void;
}

interface Mentionable {
  id: string;
  name: string;
  type: 'AI' | 'HUMAN';
}

function renderCommentContent(content: string) {
  return content.split(/(@\S+)/g).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="font-medium text-violet-600 bg-violet-50 rounded px-0.5">{part}</span>
      : <span key={i}>{part}</span>
  );
}

function RunLogEntry({ run }: { run: AgentRunLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-100 bg-white">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {expanded ? <ChevronDown size={13} className="shrink-0 text-zinc-400" /> : <ChevronRight size={13} className="shrink-0 text-zinc-400" />}
        <span className={`rounded text-[10px] font-semibold px-1.5 py-0.5 ${RUN_STATUS_COLOR[run.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
          {run.status}
        </span>
        <span className="text-xs text-zinc-500">{run.iterations} iter</span>
        {(run.totalInputTokens > 0 || run.totalOutputTokens > 0) && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Coins size={10} />
            {(run.totalInputTokens + run.totalOutputTokens).toLocaleString()} tok
            <span className="text-zinc-300">({run.totalInputTokens.toLocaleString()} in / {run.totalOutputTokens.toLocaleString()} out)</span>
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-300">{new Date(run.startedAt).toLocaleString()}</span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-50 px-3 pb-3 pt-2 space-y-1.5 max-h-64 overflow-y-auto">
          {run.log.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="shrink-0 rounded px-1 py-0.5 font-mono font-medium bg-zinc-50 text-zinc-500">
                #{step.iteration}
              </span>
              <div className="flex-1 overflow-x-auto">
                {/* Per-step token + context stats */}
                {(step.input_tokens != null || step.context_messages != null) && (
                  <div className="mb-1 flex items-center gap-2.5 text-[9px] text-zinc-400">
                    {step.input_tokens != null && (
                      <span className="flex items-center gap-0.5">
                        <Coins size={8} /> {step.input_tokens.toLocaleString()} in / {(step.output_tokens ?? 0).toLocaleString()} out
                      </span>
                    )}
                    {step.context_messages != null && (
                      <span className="flex items-center gap-0.5">
                        <BookOpen size={8} /> {step.context_messages} msgs in ctx
                      </span>
                    )}
                  </div>
                )}
                {step.error && (
                  <pre className="whitespace-pre-wrap text-red-600 font-mono text-[10px]">{step.error}</pre>
                )}
                {step.llm_content && (
                  <p className="text-zinc-600 text-[10px]">{step.llm_content}</p>
                )}
                {step.tool_calls?.map((tc, j) => (
                  <div key={j} className="mt-1 rounded bg-purple-50 px-1.5 py-1 text-purple-700">
                    <span className="font-semibold">{tc.name}</span>
                    <pre className="mt-0.5 whitespace-pre-wrap text-[9px] text-purple-500">{JSON.stringify(tc.arguments, null, 2)}</pre>
                    <pre className="mt-0.5 whitespace-pre-wrap text-[9px] text-green-600">{tc.result}</pre>
                  </div>
                ))}
              </div>
              <span className="shrink-0 text-zinc-300">{new Date(step.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          {run.log.length === 0 && <p className="text-xs text-zinc-300">No steps logged</p>}
        </div>
      )}
    </div>
  );
}

export function TaskDetail({ taskId, projectId, open, onClose }: TaskDetailProps) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState<'details' | 'logs'>('details');
  const [mounted, setMounted] = useState(false);
  const [description, setDescription] = useState('');
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mentionQuery !== null) { setMentionQuery(null); }
        else { onClose(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, mentionQuery]);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', projectId, taskId],
    queryFn: () => tasksApi.get(projectId, taskId),
    enabled: open,
  });

  // Sync description from fetched task (only when not dirty)
  useEffect(() => {
    if (task && !descriptionDirty) {
      setDescription(task.description ?? '');
    }
  }, [task?.description]);

  const { data: projectAgents = [] } = useQuery({
    queryKey: ['project-agents', projectId],
    queryFn: () => projectsApi.listAgents(projectId),
    enabled: open,
  });

  const mentionables: Mentionable[] = projectAgents
    .filter((pa) => pa.agent)
    .map((pa) => ({
      id: pa.id,
      name: pa.agent!.name,
      type: pa.agent!.type,
    }));

  const filteredMentions = mentionQuery !== null
    ? mentionables.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const { data: runLogs = [] } = useQuery<AgentRunLog[]>({
    queryKey: ['task-runs', projectId, taskId],
    queryFn: () => agentRunsApi.list(projectId, taskId),
    enabled: open,
    refetchInterval: (query) => {
      const logs = query.state.data ?? [];
      return logs.some((r: AgentRunLog) => r.status === 'RUNNING') ? 3000 : false;
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.update(projectId, taskId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['task', projectId, taskId] });
    },
  });

  const addComment = useMutation({
    mutationFn: () => tasksApi.addComment(projectId, taskId, comment),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['task', projectId, taskId] });
    },
  });

  const triggerRun = useMutation({
    mutationFn: () => agentRunsApi.trigger(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-runs', projectId, taskId] });
      setTab('logs');
    },
  });

  const stopRun = useMutation({
    mutationFn: () => agentRunsApi.stop(projectId, taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-runs', projectId, taskId] }),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onClose();
    },
  });

  const updateDescription = useMutation({
    mutationFn: () => tasksApi.update(projectId, taskId, { description }),
    onSuccess: () => {
      setDescriptionDirty(false);
      qc.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updateAssignee = useMutation({
    mutationFn: (assigneeId: string | null) => tasksApi.update(projectId, taskId, { assigneeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const isRunning = runLogs.some((r) => r.status === 'RUNNING');

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setComment(val);
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || filteredMentions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filteredMentions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredMentions[mentionIndex].name);
    }
  };

  const insertMention = (name: string) => {
    const el = commentRef.current;
    const cursor = el?.selectionStart ?? comment.length;
    const textBeforeCursor = comment.slice(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);
    if (!match) return;
    const before = textBeforeCursor.slice(0, textBeforeCursor.length - match[0].length);
    const after = comment.slice(cursor);
    // Wrap name without spaces in it — use display name as-is, replacing spaces with underscores for the token
    const token = name.replace(/\s+/g, '_');
    const newComment = `${before}@${token} ${after}`;
    setComment(newComment);
    setMentionQuery(null);
    setTimeout(() => {
      if (el) {
        const pos = before.length + token.length + 2;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] rounded-xl bg-white shadow-2xl ring-1 ring-zinc-200 flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
        {isLoading || !task ? (
          <div className="py-12 text-center text-sm text-zinc-400">Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
              <h2 className="text-base font-semibold text-zinc-900 leading-snug">{task.title}</h2>
              <div className="flex items-center gap-1 shrink-0">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                    <span className="text-xs text-red-600">Delete task?</span>
                    <button
                      onClick={() => deleteTask.mutate()}
                      disabled={deleteTask.isPending}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deleteTask.isPending ? 'Deleting…' : 'Yes'}
                    </button>
                    <span className="text-zinc-300">·</span>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-zinc-400 hover:text-zinc-600">
                      No
                    </button>
                  </div>
                )}
                <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-6 py-4 flex flex-col gap-4">

            <div className="flex items-center gap-3">
              <Select value={task.status} onValueChange={(v) => v && updateStatus.mutate(v as TaskStatus)}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-xs">{task.priority}</Badge>
              {task.dueDate && (
                <span className="flex items-center gap-1 text-xs text-zinc-400">
                  <Clock size={11} />
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
              {/* Assignee picker */}
              <Select
                value={task.assigneeId ?? '__unassigned__'}
                onValueChange={(v) => updateAssignee.mutate(v === '__unassigned__' ? null : v)}
              >
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue>
                    {task.assignee ? (
                      <span className="flex items-center gap-1.5 truncate">
                        {task.assignee.agent?.type === 'AI'
                          ? <Bot size={12} className="shrink-0 text-violet-400" />
                          : <User size={12} className="shrink-0 text-zinc-400" />
                        }
                        {task.assignee.agent?.name}
                      </span>
                    ) : (
                      <span className="text-zinc-400">Unassigned</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">
                    <span className="text-zinc-400">Unassigned</span>
                  </SelectItem>
                  {projectAgents.filter((pa) => pa.agent).map((pa) => (
                    <SelectItem key={pa.id} value={pa.id}>
                      <span className="flex items-center gap-1.5">
                        {pa.agent?.type === 'AI'
                          ? <Bot size={12} className="shrink-0 text-violet-400" />
                          : <User size={12} className="shrink-0 text-zinc-400" />
                        }
                        {pa.agent?.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {task.assignee?.agent?.type === 'AI' && (
                <div className="ml-auto flex items-center gap-2">
                  {isRunning ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => stopRun.mutate()}
                      disabled={stopRun.isPending}
                    >
                      <StopCircle size={12} className="mr-1" /> Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => triggerRun.mutate()}
                      disabled={triggerRun.isPending}
                    >
                      <Play size={12} className="mr-1" /> Run agent
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-zinc-100">
              {(['details', 'logs'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                    tab === t ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {t === 'logs' ? (
                    <span className="flex items-center gap-1.5"><ScrollText size={13} /> Logs</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><MessageSquare size={13} /> Details</span>
                  )}
                </button>
              ))}
            </div>

            {/* Details tab */}
            {tab === 'details' && (
              <>
                {/* Blocker banner */}
                {task.status === 'BLOCKED' && (() => {
                  const blockReason = [...(task.comments ?? [])].reverse().find((c) => c.authorType === 'agent');
                  const blockers = (task as any).blockedBy ?? [];
                  if (!blockReason && blockers.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
                        <AlertTriangle size={14} className="shrink-0" />
                        Blocked
                      </div>
                      {blockReason && (
                        <p className="text-sm text-red-600 whitespace-pre-wrap leading-relaxed">{blockReason.content}</p>
                      )}
                      {blockers.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Waiting on</p>
                          {blockers.map((dep: { blockingTask: { id: string; title: string; status: string } }) => (
                            <div key={dep.blockingTask.id} className="flex items-center gap-2 text-xs text-red-600">
                              <Link2 size={11} className="shrink-0" />
                              <span className="truncate">{dep.blockingTask.title}</span>
                              <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 bg-red-100 text-red-500 font-medium">
                                {dep.blockingTask.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-1.5">
                  <Textarea
                    rows={4}
                    placeholder="Describe the requirements for this task…"
                    className="text-sm resize-none"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setDescriptionDirty(true); }}
                  />
                  {descriptionDirty && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setDescription(task.description ?? ''); setDescriptionDirty(false); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={updateDescription.isPending}
                        onClick={() => updateDescription.mutate()}
                      >
                        {updateDescription.isPending ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>

                {(() => {
                  const totalIn = runLogs.reduce((s, r) => s + (r.totalInputTokens ?? 0), 0);
                  const totalOut = runLogs.reduce((s, r) => s + (r.totalOutputTokens ?? 0), 0);
                  if (totalIn === 0 && totalOut === 0) return null;
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Coins size={12} className="text-zinc-300" />
                      <span className="font-medium text-zinc-600">{(totalIn + totalOut).toLocaleString()}</span> tokens
                      <span className="text-zinc-300">({totalIn.toLocaleString()} in / {totalOut.toLocaleString()} out)</span>
                    </div>
                  );
                })()}

                <Separator />

                {(task.activities?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Activity</p>
                    {task.activities?.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-xs text-zinc-500">
                        <span>{a.actorType === 'agent' ? '🤖' : '👤'}</span>
                        <span>{a.action}</span>
                        <span className="ml-auto text-zinc-300">{new Date(a.createdAt).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <MessageSquare size={12} /> Comments
                  </p>

                  {task.comments?.length === 0 && (
                    <p className="text-xs text-zinc-300">No comments yet</p>
                  )}

                  {task.comments?.map((c: { id: string; content: string; authorType: string; createdAt: string }) => (
                    <div key={c.id} className="flex gap-2">
                      <span className="mt-0.5 shrink-0">{c.authorType === 'agent' ? '🤖' : '👤'}</span>
                      <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 flex-1">
                        <p className="whitespace-pre-wrap">{renderCommentContent(c.content)}</p>
                        <p className="mt-1 text-[10px] text-zinc-300">{new Date(c.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Logs tab */}
            {tab === 'logs' && (
              <div className="space-y-3">
                {runLogs.length === 0 ? (
                  <div className="py-8 text-center text-sm text-zinc-400">
                    No agent runs yet
                    {task.assignee?.agent?.type === 'AI' && (
                      <p className="mt-1 text-xs text-zinc-300">Set task to TODO to auto-trigger, or click "Run agent" above</p>
                    )}
                  </div>
                ) : (
                  runLogs.map((run) => <RunLogEntry key={run.id} run={run} />)
                )}
              </div>
            )}
            </div>
            </div>{/* end scrollable body */}

            {/* Comment input — sticky footer, always inside panel */}
            {tab === 'details' && (
              <div className="shrink-0 border-t border-zinc-100 px-6 py-3">
                <div className="relative">
                  <Textarea
                    ref={commentRef}
                    rows={2}
                    placeholder="Add a comment… (type @ to mention)"
                    className="text-sm w-full"
                    value={comment}
                    onChange={handleCommentChange}
                    onKeyDown={handleCommentKeyDown}
                  />
                  {/* Mention dropdown */}
                  {mentionQuery !== null && filteredMentions.length > 0 && (
                    <div className="absolute bottom-full mb-1 left-0 z-10 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                        Mention
                      </div>
                      {filteredMentions.map((m, i) => (
                        <button
                          key={m.id}
                          onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                            i === mentionIndex ? 'bg-violet-50 text-violet-700' : 'text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          {m.type === 'AI'
                            ? <Bot size={13} className="shrink-0 text-violet-400" />
                            : <User size={13} className="shrink-0 text-zinc-400" />
                          }
                          <span className="truncate">{m.name}</span>
                          {m.type === 'AI' && (
                            <span className="ml-auto text-[10px] text-violet-400">AI</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {mentionQuery !== null && filteredMentions.length === 0 && mentionQuery.length > 0 && (
                    <div className="absolute bottom-full mb-1 left-0 z-10 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg px-3 py-2 text-xs text-zinc-400">
                      No matches for &ldquo;@{mentionQuery}&rdquo;
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    disabled={!comment.trim() || addComment.isPending}
                    onClick={() => addComment.mutate()}
                  >
                    {addComment.isPending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
