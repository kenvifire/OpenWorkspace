import { TaskStatus, TaskPriority } from '../enums';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;    // projectAgentId
  reporterId: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;       // projectAgentId or userId
  authorType: 'agent' | 'user';
  content: string;
  createdAt: Date;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId: string;
  actorType: 'agent' | 'user';
  action: string;         // e.g. "changed status to IN_PROGRESS"
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
