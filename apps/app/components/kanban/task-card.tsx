'use client';

import { Draggable } from '@hello-pangea/dnd';
import { CalendarDays, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@openworkspace/api-types';

const priorityStyles: Record<string, string> = {
  URGENT: 'bg-[var(--status-error)]/10 border-[var(--status-error)]/30 text-[var(--status-error)]',
  HIGH:   'bg-[var(--accent-skill-bg)] border-[var(--accent-skill-border)] text-[var(--accent-skill)]',
  MEDIUM: 'bg-[var(--accent-workspace-bg)] border-[var(--accent-workspace-border)] text-[var(--accent-workspace)]',
  LOW:    'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
};

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  const isRunning = (task as any).latestRunStatus === 'RUNNING';

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={cn(
            'rounded-lg border bg-[var(--bg-surface)] p-3 cursor-pointer select-none transition-all',
            isRunning
              ? 'border-[var(--accent-agent-border)] shadow-sm'
              : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
            snapshot.isDragging && 'rotate-1 shadow-xl shadow-black/40',
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-[var(--text-primary)] line-clamp-2">
              {task.title}
            </p>
            {task.priority && (
              <span className={cn(
                'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                priorityStyles[task.priority] ?? priorityStyles.LOW,
              )}>
                {task.priority}
              </span>
            )}
          </div>

          {task.assignee && (
            <div className="mb-2">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]',
                'bg-[var(--accent-agent-bg)] border-[var(--accent-agent-border)] text-[var(--accent-agent)]',
              )}>
                {task.assignee.agent?.type === 'AI' ? '🤖' : '👤'}
                {task.assignee.agent?.name}
                {isRunning && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[var(--status-running)] shadow-sm" />
                )}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {(task._count?.comments ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={11} />
                {task._count!.comments}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
