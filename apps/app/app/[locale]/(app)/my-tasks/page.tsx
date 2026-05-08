'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { myTasksApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { cn } from '@/lib/utils';
import type { Task } from '@openworkspace/api-types';
import { TaskDetail } from '@/components/kanban/task-detail';
import { Loader2, CheckSquare } from 'lucide-react';

type MyTask = Task & { project: { id: string; name: string; workspace: { slug: string } } };

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
  TODO: 'bg-blue-500/10 text-blue-400',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-400',
  BLOCKED: 'bg-red-500/10 text-red-400',
  DONE: 'bg-emerald-500/10 text-emerald-400',
};

const PRIORITY_DOTS: Record<string, string> = {
  LOW: 'bg-[var(--text-muted)]',
  MEDIUM: 'bg-amber-400',
  HIGH: 'bg-red-400',
  URGENT: 'bg-red-600',
};

export default function MyTasksPage() {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<{ taskId: string; projectId: string } | null>(null);

  const { data: tasks = [], isLoading } = useQuery<MyTask[]>({
    queryKey: ['my-tasks'],
    queryFn: myTasksApi.list,
    enabled: !!user,
  });

  // Group by project
  const grouped = tasks.reduce<Record<string, { projectName: string; slug: string; tasks: MyTask[] }>>(
    (acc, task) => {
      const key = task.project.id;
      if (!acc[key]) {
        acc[key] = { projectName: task.project.name, slug: task.project.workspace.slug, tasks: [] };
      }
      acc[key].tasks.push(task);
      return acc;
    },
    {},
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <CheckSquare size={22} className="text-[var(--accent-workspace)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          My Tasks
        </h1>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16 text-center">
          <CheckSquare size={32} className="text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([projectId, group]) => (
            <div key={projectId}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                {group.projectName}
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {group.tasks.map((task, i) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask({ taskId: task.id, projectId: task.project.id })}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)]',
                      i > 0 && 'border-t border-[var(--border-subtle)]',
                    )}
                  >
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOTS[task.priority] ?? 'bg-[var(--text-muted)]')}
                    />
                    <span className="flex-1 truncate text-sm text-[var(--text-primary)]">{task.title}</span>
                    <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', STATUS_COLORS[task.status])}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetail
          taskId={selectedTask.taskId}
          projectId={selectedTask.projectId}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
