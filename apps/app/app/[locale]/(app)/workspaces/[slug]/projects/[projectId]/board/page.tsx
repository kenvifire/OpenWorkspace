'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import type { DropResult } from '@hello-pangea/dnd';
import { useLocale } from 'next-intl';
import type { Task, TaskStatus } from '@openworkspace/api-types';

const DragDropContext = dynamic(
  () => import('@hello-pangea/dnd').then((m) => m.DragDropContext),
  { ssr: false },
);
const Droppable = dynamic(
  () => import('@hello-pangea/dnd').then((m) => m.Droppable),
  { ssr: false },
);
import Link from 'next/link';
import { tasksApi, projectsApi } from '@/lib/api';
import { useKanban } from '@/hooks/use-socket';
import { TaskCard } from '@/components/kanban/task-card';
import { TaskDetail } from '@/components/kanban/task-detail';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Store, ArrowLeft, AlertTriangle, Settings2 } from 'lucide-react';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-zinc-200' },
  { id: 'TODO', label: 'To Do', color: 'bg-blue-200' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-200' },
  { id: 'BLOCKED', label: 'Blocked', color: 'bg-red-200' },
  { id: 'DONE', label: 'Done', color: 'bg-green-200' },
];


export default function BoardPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = use(params);
  const locale = useLocale();
  const qc = useQueryClient();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);

  useKanban(projectId);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.list(projectId),
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Record<string, unknown> }) =>
      tasksApi.update(projectId, taskId, data),
    onMutate: async ({ taskId, data }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const prev = qc.getQueryData<Task[]>(['tasks', projectId]);
      qc.setQueryData<Task[]>(['tasks', projectId], (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', projectId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const createTask = useMutation({
    mutationFn: ({ title, status }: { title: string; status: TaskStatus }) =>
      tasksApi.create(projectId, { title, status }),
    onSuccess: () => {
      setNewTaskTitle('');
      setAddingToColumn(null);
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (err: any) => {
      console.error('[createTask] failed:', err?.response?.data ?? err);
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    if (result.source.droppableId === newStatus) return;
    updateTask.mutate({ taskId: result.draggableId, data: { status: newStatus } });
  };

  const tasksByStatus = COLUMNS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id);
    return acc;
  }, {});

  const blockedCount = tasksByStatus['BLOCKED']?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-200 bg-white px-6 py-3">
        <Link href={`/${locale}/workspaces/${slug}`} className="text-zinc-400 hover:text-zinc-700">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-zinc-900">{project?.name ?? '…'}</h1>
        </div>
        {blockedCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">
            <AlertTriangle size={14} />
            {blockedCount} blocked task{blockedCount > 1 ? 's' : ''}
          </div>
        )}
        <Link href={`/${locale}/workspaces/${slug}/projects/${projectId}/settings`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          <Settings2 size={14} className="mr-1.5" /> Settings
        </Link>
        <Link href={`/${locale}/marketplace`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          <Store size={14} className="mr-1.5" /> Hire Agent
        </Link>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex gap-4 p-6">
          {COLUMNS.map((col) => <Skeleton key={col.id} className="h-96 w-64 shrink-0 rounded-xl" />)}
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-4 overflow-x-auto p-6">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex w-64 shrink-0 flex-col">
                {/* Column header */}
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                  <span className="text-sm font-semibold text-zinc-700">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {tasksByStatus[col.id].length}
                  </Badge>
                </div>

                {/* Cards */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-1 flex-col gap-2 rounded-xl p-2 transition-colors min-h-[100px] ${
                        snapshot.isDraggingOver ? 'bg-zinc-100' : 'bg-zinc-50'
                      }`}
                    >
                      {tasksByStatus[col.id].map((task, i) => (
                        <TaskCard key={task.id} task={task} index={i} onClick={setSelectedTask} />
                      ))}
                      {provided.placeholder}

                      {/* Add task inline */}
                      {addingToColumn === col.id ? (
                        <div className="mt-1 space-y-1.5">
                          <Input
                            autoFocus
                            placeholder="Task title…"
                            className="h-8 text-sm"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newTaskTitle.trim()) createTask.mutate({ title: newTaskTitle, status: col.id });
                              if (e.key === 'Escape') { setAddingToColumn(null); setNewTaskTitle(''); }
                            }}
                          />
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => createTask.mutate({ title: newTaskTitle, status: col.id })} disabled={!newTaskTitle.trim() || createTask.isPending}>
                              Add
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingToColumn(null); setNewTaskTitle(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingToColumn(col.id)}
                          className="mt-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        >
                          <Plus size={12} /> Add task
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetail
          taskId={selectedTask.id}
          projectId={projectId}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
