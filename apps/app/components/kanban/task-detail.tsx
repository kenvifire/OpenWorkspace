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
  RUNNING:        'bg-[var(--accent-agent-bg)] text-[var(--accent-agent)]',
  COMPLETED:      'bg-[var(--accent-mcp-bg)] text-[var(--status-running)]',
  STOPPED:        'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
  FAILED:         'bg-[var(--status-error)]/10 text-[var(--status-error)]',
  MAX_ITERATIONS: 'bg-[var(--accent-skill-bg)] text-[var(--accent-skill)]',
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
      ? <span key={i} className="font-medium text-[var(--accent-workspace)] bg-[var(--accent-workspace-bg)] rounded px-0.5">{part}</span>
      : <span key={i}>{part}</span>
  );
}

function RunLogEntry({ run }: { run: AgentRunLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {expanded
          ? <ChevronDown size={13} className="shrink-0 text-[var(--text-muted)]" />
          : <ChevronRight size={13} className="shrink-0 text-[var(--text-muted)]" />
        }
        <span className={`rounded text-[10px] font-semibold px-1.5 py-0.5 ${RUN_STATUS_COLOR[run.status] ?? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
          {run.status}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">{run.iterations} iter</span>
        {(run.totalInputTokens > 0 || run.totalOutputTokens > 0) && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Coins size={10} />
            {(run.totalInputTokens + run.totalOutputTokens).toLocaleString()} tok
            <span className="text-[var(--text-muted)]">({run.totalInputTokens.toLocaleString()} in / {run.totalOutputTokens.toLocaleString()} out)</span>
          </span>
        )}
        <span className="ml-auto text-[10px] text-[var(--text-muted)]">{new Date(run.startedAt).toLocaleString()}</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2 space-y-1.5 max-h-64 overflow-y-auto">
          {run.log.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="shrink-0 rounded px-1 py-0.5 font-mono font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                #{step.iteration}
              </span>
              <div className="flex-1 overflow-x-auto">
                {(step.input_tokens != null || step.context_messages != null) && (
                  <div className="mb-1 flex items-center gap-2.5 text-[9px] text-[var(--text-muted)]">
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
                  <pre className="whitespace-pre-wrap text-[var(--status-error)] font-mono text-[10px]">{step.error}</pre>
                )}
                {step.llm_content && (
                  <p className="text-[var(--text-secondary)] text-[10px]">{step.llm_content}</p>
                )}
                {step.tool_calls?.map((tc, j) => (
                  <div key={j} className="mt-1 rounded bg-[var(--accent-workspace-bg)] px-1.5 py-1 text-[var(--accent-workspace)]">
                    <span className="font-semibold">{tc.name}</span>
                    <pre className="mt-0.5 whitespace-pre-wrap text-[9px] text-[var(--accent-workspace)]/70">{JSON.stringify(tc.arguments, null, 2)}</pre>
                    <pre className="mt-0.5 whitespace-pre-wrap text-[9px] text-[var(--status-running)]">{tc.result}</pre>
                  </div>
                ))}
              </div>
              <span className="shrink-0 text-[var(--text-muted)]">{new Date(step.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          {run.log.length === 0 && <p className="text-xs text-[var(--text-muted)]">No steps logged</p>}
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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] rounded-xl bg-[var(--bg-surface)] shadow-2xl ring-1 ring-[var(--border-default)] flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
        {isLoading || !task ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-[var(--border-subtle)] shrink-0">
              <h2 className="text-base font-semibold text-[var(--text-primary)] leading-snug">{task.title}</h2>
              <div className="flex items-center gap-1 shrink-0">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)] transition-colors"
                    title="Delete task"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-2 py-1">
                    <span className="text-xs text-[var(--status-error)]">Delete task?</span>
                    <button
                      onClick={() => deleteTask.mutate()}
                      disabled={deleteTask.isPending}
                      className="text-xs font-semibold text-[var(--status-error)] hover:opacity-80 disabled:opacity-50"
                    >
                      {deleteTask.isPending ? 'Deleting…' : 'Yes'}
                    </button>
                    <span className="text-[var(--text-muted)]">·</span>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                      No
                    </button>
                  </div>
                )}
                <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors">
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
                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
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
                          ? <Bot size={12} className="shrink-0 text-[var(--accent-workspace)]" />
                          : <User size={12} className="shrink-0 text-[var(--text-muted)]" />
                        }
                        {task.assignee.agent?.name}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">Unassigned</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">
                    <span className="text-[var(--text-muted)]">Unassigned</span>
                  </SelectItem>
                  {projectAgents.filter((pa) => pa.agent).map((pa) => (
                    <SelectItem key={pa.id} value={pa.id}>
                      <span className="flex items-center gap-1.5">
                        {pa.agent?.type === 'AI'
                          ? <Bot size={12} className="shrink-0 text-[var(--accent-workspace)]" />
                          : <User size={12} className="shrink-0 text-[var(--text-muted)]" />
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
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => stopRun.mutate()}
                      disabled={stopRun.isPending}
                    >
                      <StopCircle size={12} className="mr-1" /> Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="action"
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
            <div className="flex gap-4 border-b border-[var(--border-subtle)]">
              {(['details', 'logs'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                    tab === t
                      ? 'border-[var(--accent-workspace)] text-[var(--accent-workspace)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
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
                    <div className="rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2 text-[var(--status-error)] font-medium text-sm">
                        <AlertTriangle size={14} className="shrink-0" />
                        Blocked
                      </div>
                      {blockReason && (
                        <p className="text-sm text-[var(--status-error)] whitespace-pre-wrap leading-relaxed">{blockReason.content}</p>
                      )}
                      {blockers.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-xs font-semibold text-[var(--status-error)] uppercase tracking-wide">Waiting on</p>
                          {blockers.map((dep: { blockingTask: { id: string; title: string; status: string } }) => (
                            <div key={dep.blockingTask.id} className="flex items-center gap-2 text-xs text-[var(--status-error)]">
                              <Link2 size={11} className="shrink-0" />
                              <span className="truncate">{dep.blockingTask.title}</span>
                              <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 bg-[var(--status-error)]/10 text-[var(--status-error)] font-medium">
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
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Coins size={12} className="text-[var(--text-muted)]" />
                      <span className="font-medium text-[var(--text-secondary)]">{(totalIn + totalOut).toLocaleString()}</span> tokens
                      <span className="text-[var(--text-muted)]">({totalIn.toLocaleString()} in / {totalOut.toLocaleString()} out)</span>
                    </div>
                  );
                })()}

                <Separator />

                {(task.activities?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Activity</p>
                    {task.activities?.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                        <span>{a.actorType === 'agent' ? '🤖' : '👤'}</span>
                        <span>{a.action}</span>
                        <span className="ml-auto text-[var(--text-muted)]">{new Date(a.createdAt).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <MessageSquare size={12} /> Comments
                  </p>

                  {task.comments?.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">No comments yet</p>
                  )}

                  {task.comments?.map((c: { id: string; content: string; authorType: string; createdAt: string }) => (
                    <div key={c.id} className="flex gap-2">
                      <span className="mt-0.5 shrink-0">{c.authorType === 'agent' ? '🤖' : '👤'}</span>
                      <div className="rounded-lg bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] flex-1">
                        <p className="whitespace-pre-wrap">{renderCommentContent(c.content)}</p>
                        <p className="mt-1 text-[10px] text-[var(--text-muted)]">{new Date(c.createdAt).toLocaleString()}</p>
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
                  <div className="py-8 text-center text-sm text-[var(--text-muted)]">
                    No agent runs yet
                    {task.assignee?.agent?.type === 'AI' && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Set task to TODO to auto-trigger, or click &quot;Run agent&quot; above</p>
                    )}
                  </div>
                ) : (
                  runLogs.map((run) => <RunLogEntry key={run.id} run={run} />)
                )}
              </div>
            )}
            </div>
            </div>{/* end scrollable body */}

            {/* Comment input — sticky footer */}
            {tab === 'details' && (
              <div className="shrink-0 border-t border-[var(--border-subtle)] px-6 py-3">
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
                    <div className="absolute bottom-full mb-1 left-0 z-10 w-56 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                        Mention
                      </div>
                      {filteredMentions.map((m, i) => (
                        <button
                          key={m.id}
                          onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                            i === mentionIndex
                              ? 'bg-[var(--accent-workspace-bg)] text-[var(--accent-workspace)]'
                              : 'text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'
                          }`}
                        >
                          {m.type === 'AI'
                            ? <Bot size={13} className="shrink-0 text-[var(--accent-workspace)]" />
                            : <User size={13} className="shrink-0 text-[var(--text-muted)]" />
                          }
                          <span className="truncate">{m.name}</span>
                          {m.type === 'AI' && (
                            <span className="ml-auto text-[10px] text-[var(--accent-workspace)]">AI</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {mentionQuery !== null && filteredMentions.length === 0 && mentionQuery.length > 0 && (
                    <div className="absolute bottom-full mb-1 left-0 z-10 w-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-lg px-3 py-2 text-xs text-[var(--text-muted)]">
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
