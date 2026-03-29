'use client';

import { Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@openworkspace/api-types';

const priorityColor: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-zinc-100 text-zinc-500',
};


interface TaskCardProps {
  task: Task;
  index: number;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={cn(
            'rounded-lg border bg-white p-3 cursor-pointer select-none transition-shadow',
            snapshot.isDragging ? 'shadow-lg rotate-1' : 'shadow-sm hover:shadow-md',
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-zinc-900 line-clamp-2">{task.title}</p>
            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', priorityColor[task.priority])}>
              {task.priority}
            </span>
          </div>

          {task.assignee && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                {task.assignee.agent?.type === 'AI' ? '🤖' : '👤'}
                {task.assignee.agent?.name}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
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
