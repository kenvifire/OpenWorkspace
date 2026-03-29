import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { KanbanGateway } from '../../gateway/kanban.gateway';
import { AgentRunnerService } from '../agent-runner/agent-runner.service';
import { PlannerService } from '../planner/planner.service';
import { TaskStatus, TaskPriority, User, ProjectAgent } from '@prisma/client';

type Actor =
  | { type: 'user'; entity: User }
  | { type: 'agent'; entity: ProjectAgent & { project: { workspaceId: string } } };

// ── Minimal mock factories ───────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  firebaseUid: 'firebase-uid-1',
  avatarUrl: null,
  planningAgentDefaultPrompt: null,
  planningAgentProvider: null,
  planningAgentModel: null,
  planningAgentEncryptedApiKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeProjectAgent = (overrides: Partial<ProjectAgent & { project: { workspaceId: string } }> = {}) => ({
  id: 'pa-1',
  agentId: 'agent-1',
  projectId: 'proj-1',
  role: 'DEVELOPER',
  customRole: null,
  isCoordinator: false,
  hiredAt: new Date(),
  keyHash: 'hash',
  project: { workspaceId: 'ws-1' },
  ...overrides,
});

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  projectId: 'proj-1',
  title: 'Test Task',
  description: null,
  status: 'BACKLOG' as TaskStatus,
  priority: 'MEDIUM' as TaskPriority,
  assigneeId: null,
  reporterId: 'user-1',
  reporterType: 'user',
  dueDate: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  task: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectAgent: {
    findUnique: jest.fn(),
  },
  workspaceMember: {
    findUnique: jest.fn(),
  },
  taskComment: {
    create: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
  agentRunLog: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockGateway = {
  emit: jest.fn(),
};

const mockAgentRunner = {
  enqueue: jest.fn(),
  stop: jest.fn(),
};

const mockPlannerService = {
  autoAssignNewTask: jest.fn(),
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('TasksService', () => {
  let service: TasksService;

  const userActor: Actor = {
    type: 'user',
    entity: makeUser({ id: 'user-1', email: 'test@test.com', name: 'Test User' }),
  };

  const projectId = 'proj-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KanbanGateway, useValue: mockGateway },
        { provide: AgentRunnerService, useValue: mockAgentRunner },
        { provide: PlannerService, useValue: mockPlannerService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);

    // Default: project exists + user is a workspace member
    mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, workspaceId: 'ws-1' });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-1' });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return tasks filtered by projectId', async () => {
      const tasks = [makeTask(), makeTask({ id: 'task-2' })];
      mockPrisma.task.findMany.mockResolvedValue(tasks);

      const result = await service.findAll(projectId, userActor);

      expect(result).toEqual(tasks);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId, deletedAt: null } }),
      );
    });

    it('should throw ForbiddenException if user is not a project member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.findAll(projectId, userActor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create task with BACKLOG status when no assigneeId', async () => {
      const task = makeTask({ status: 'BACKLOG' as TaskStatus });
      mockPrisma.task.create.mockResolvedValue(task);

      const dto = { title: 'New Task', status: TaskStatus.BACKLOG };
      const result = await service.create(projectId, dto, userActor);

      expect(result).toEqual(task);
      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ projectId, title: 'New Task' }),
        }),
      );
    });

    it('should set status to TODO and call agentRunner.enqueue when assignee is an AI agent', async () => {
      const task = makeTask({ status: 'TODO' as TaskStatus, assigneeId: 'pa-1' });
      mockPrisma.task.create.mockResolvedValue(task);
      mockPrisma.projectAgent.findUnique.mockResolvedValue({
        id: 'pa-1',
        agentId: 'agent-1',
        projectId,
        agent: { type: 'AI' },
      });
      mockPrisma.agentRunLog.findFirst.mockResolvedValue(null);
      mockAgentRunner.enqueue.mockResolvedValue(undefined);

      const dto = { title: 'AI Task', status: TaskStatus.TODO, assigneeId: 'pa-1' };
      await service.create(projectId, dto, userActor);

      expect(mockAgentRunner.enqueue).toHaveBeenCalledWith('task-1', 'pa-1');
    });

    it('should auto-assign via planner when actor is agent and no assigneeId', async () => {
      const task = makeTask();
      mockPrisma.task.create.mockResolvedValue(task);
      mockPlannerService.autoAssignNewTask.mockResolvedValue(undefined);

      const agentActor: Actor = {
        type: 'agent',
        entity: makeProjectAgent() as ProjectAgent & { project: { workspaceId: string } },
      };

      const dto = { title: 'Planner Task' };
      await service.create(projectId, dto, agentActor);

      expect(mockPlannerService.autoAssignNewTask).toHaveBeenCalledWith('task-1', projectId);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should update task fields', async () => {
      const existing = makeTask();
      const updated = makeTask({ title: 'Updated Title' });

      mockPrisma.task.findUnique.mockResolvedValue(existing);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn({
          ...mockPrisma,
          task: { ...mockPrisma.task, update: jest.fn().mockResolvedValue(updated) },
          taskActivity: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as typeof mockPrisma);
      });
      mockPrisma.projectAgent.findUnique.mockResolvedValue(null);

      const result = await service.update(projectId, 'task-1', { title: 'Updated Title' }, userActor);

      expect(result).toEqual(updated);
      expect(mockGateway.emit).toHaveBeenCalledWith('task:updated', expect.objectContaining({ projectId }));
    });

    it('should call agentRunner.enqueue when status changes to TODO with AI assignee', async () => {
      const existing = makeTask({ status: 'BACKLOG' as TaskStatus, assigneeId: 'pa-1' });
      const updated = makeTask({ status: 'TODO' as TaskStatus, assigneeId: 'pa-1' });

      mockPrisma.task.findUnique.mockResolvedValue(existing);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn({
          ...mockPrisma,
          task: { ...mockPrisma.task, update: jest.fn().mockResolvedValue(updated) },
          taskActivity: { create: jest.fn().mockResolvedValue({}) },
        } as unknown as typeof mockPrisma);
      });
      mockPrisma.projectAgent.findUnique.mockResolvedValue({
        id: 'pa-1',
        agentId: 'agent-1',
        projectId,
        agent: { type: 'AI' },
      });
      mockPrisma.agentRunLog.findFirst.mockResolvedValue(null);
      mockAgentRunner.enqueue.mockResolvedValue(undefined);

      await service.update(projectId, 'task-1', { status: TaskStatus.TODO }, userActor);

      expect(mockAgentRunner.enqueue).toHaveBeenCalledWith('task-1', 'pa-1');
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.update(projectId, 'nonexistent', { title: 'X' }, userActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addComment ─────────────────────────────────────────────────────────────

  describe('addComment()', () => {
    it('should create comment and emit kanban event', async () => {
      const task = makeTask();
      const comment = {
        id: 'comment-1',
        taskId: 'task-1',
        authorId: 'user-1',
        authorType: 'user',
        content: 'Hello',
        createdAt: new Date(),
      };

      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.taskComment.create.mockResolvedValue(comment);

      const result = await service.addComment(projectId, 'task-1', { content: 'Hello' }, userActor);

      expect(result).toEqual(comment);
      expect(mockPrisma.taskComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: 'Hello', taskId: 'task-1' }),
        }),
      );
      expect(mockGateway.emit).toHaveBeenCalledWith('comment:created', expect.objectContaining({ projectId }));
    });

    it('should re-trigger agent when human comments on BLOCKED task with assignee', async () => {
      const task = makeTask({ status: 'BLOCKED' as TaskStatus, assigneeId: 'pa-1' });
      const comment = {
        id: 'comment-1',
        taskId: 'task-1',
        authorId: 'user-1',
        authorType: 'user',
        content: 'Unblocking you',
        createdAt: new Date(),
      };

      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.taskComment.create.mockResolvedValue(comment);
      mockAgentRunner.stop.mockResolvedValue(undefined);
      mockAgentRunner.enqueue.mockResolvedValue(undefined);

      await service.addComment(projectId, 'task-1', { content: 'Unblocking you' }, userActor);

      expect(mockAgentRunner.stop).toHaveBeenCalledWith('task-1');
      expect(mockAgentRunner.enqueue).toHaveBeenCalledWith('task-1', 'pa-1');
    });
  });

  // ── deleteTask ─────────────────────────────────────────────────────────────

  describe('deleteTask()', () => {
    it('should soft-delete by setting deletedAt', async () => {
      const task = makeTask({ assigneeId: null });
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.task.update.mockResolvedValue({ ...task, deletedAt: new Date() });
      mockAgentRunner.stop.mockResolvedValue(undefined);

      const result = await service.deleteTask(projectId, 'task-1', userActor);

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date), assigneeId: null }),
        }),
      );
      expect(mockGateway.emit).toHaveBeenCalledWith('task:deleted', expect.objectContaining({ projectId }));
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.deleteTask(projectId, 'nonexistent', userActor)).rejects.toThrow(NotFoundException);
    });
  });
});
