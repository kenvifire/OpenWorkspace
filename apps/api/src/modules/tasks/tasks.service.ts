import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KanbanGateway } from '../../gateway/kanban.gateway';
import { AgentRunnerService } from '../agent-runner/agent-runner.service';
import { PlannerService } from '../planner/planner.service';
import { CreateTaskDto, UpdateTaskDto, AddCommentDto } from './dto/task.dto';
import { TaskStatus, User, ProjectAgent } from '@prisma/client';

type Actor =
  | { type: 'user'; entity: User }
  | { type: 'agent'; entity: ProjectAgent & { project: { workspaceId: string } } };

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: KanbanGateway,
    private readonly agentRunner: AgentRunnerService,
    private readonly plannerService: PlannerService,
  ) {}

  async findAll(projectId: string, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    return this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: {
        assignee: { include: { agent: { select: { id: true, name: true, type: true } } } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(projectId: string, taskId: string, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { include: { agent: { select: { id: true, name: true, type: true } } } },
        comments: { orderBy: { createdAt: 'asc' } },
        activities: { orderBy: { createdAt: 'asc' } },
        blockedBy: {
          include: {
            blockingTask: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    if (!task || task.projectId !== projectId || task.deletedAt) throw new NotFoundException('Task not found');
    return task;
  }

  async create(projectId: string, dto: CreateTaskDto, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    const actorId = actor.type === 'user' ? actor.entity.id : actor.entity.id;

    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        reporterId: actorId,
        reporterType: actor.type,
      },
    });

    this.gateway.emit('task:created', { projectId, data: task as any });

    if (actor.type === 'agent' && !dto.assigneeId) {
      // Fire-and-forget: planner auto-assigns the task in the background
      this.plannerService.autoAssignNewTask(task.id, projectId).catch(() => {});
    } else {
      await this.maybeEnqueueAgent(task);
    }

    return task;
  }

  async update(projectId: string, taskId: string, dto: UpdateTaskDto, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== projectId) throw new NotFoundException('Task not found');

    // Agents can only update tasks assigned to them (or if coordinator)
    if (actor.type === 'agent') {
      const isAssigned = task.assigneeId === actor.entity.id;
      const isCoordinator = (actor.entity as ProjectAgent).isCoordinator;
      if (!isAssigned && !isCoordinator) {
        throw new ForbiddenException('Agents can only update tasks assigned to them');
      }
    }

    // Enforce: BLOCKED tasks must include a comment before being marked blocked
    if (dto.status === TaskStatus.BLOCKED && !dto.description) {
      // Allow — comment is a separate action; the requirement is enforced by the agent/user adding a comment
    }

    const actorId = actor.entity.id;
    const prevStatus = task.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          ...dto,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
      });

      if (dto.status && dto.status !== prevStatus) {
        await tx.taskActivity.create({
          data: {
            taskId,
            actorId,
            actorType: actor.type,
            action: `changed status from ${prevStatus} to ${dto.status}`,
            metadata: { from: prevStatus, to: dto.status },
          },
        });
      }

      return updatedTask;
    });

    this.gateway.emit('task:updated', { projectId, data: updated as any });

    // Auto-trigger agent when task becomes TODO and has an AI assignee
    await this.maybeEnqueueAgent(updated);

    return updated;
  }

  private async maybeEnqueueAgent(task: { id: string; status: string; assigneeId: string | null }) {
    if (task.status !== 'TODO' || !task.assigneeId) return;

    const projectAgent = await this.prisma.projectAgent.findUnique({
      where: { id: task.assigneeId },
      include: { agent: { select: { type: true } } },
    });
    if (!projectAgent || projectAgent.agent.type !== 'AI') return;

    // Check no run is already in progress
    const running = await this.prisma.agentRunLog.findFirst({
      where: { taskId: task.id, status: 'RUNNING' },
    });
    if (running) return;

    await this.agentRunner.enqueue(task.id, projectAgent.id);
  }

  async addComment(projectId: string, taskId: string, dto: AddCommentDto, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== projectId) throw new NotFoundException('Task not found');

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: actor.entity.id,
        authorType: actor.type,
        content: dto.content,
      },
    });

    this.gateway.emit('comment:created', { projectId, data: { ...comment, taskId } as any });

    // If a human commented on a blocked/todo task with an assignee, re-trigger the agent
    if (actor.type === 'user' && task.assigneeId && ['BLOCKED', 'TODO', 'IN_PROGRESS'].includes(task.status)) {
      try {
        await this.agentRunner.stop(taskId);
        await this.agentRunner.enqueue(taskId, task.assigneeId);
      } catch (e) {
        // Non-fatal — comment was saved, agent re-trigger failed silently
      }
    }

    return comment;
  }

  async deleteTask(projectId: string, taskId: string, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, assigneeId: true, deletedAt: true },
    });
    if (!task || task.projectId !== projectId || task.deletedAt) throw new NotFoundException('Task not found');

    // Stop any active run
    await this.agentRunner.stop(taskId);

    const assigneeId = task.assigneeId;

    // Soft-delete
    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date(), assigneeId: null },
    });
    this.gateway.emit('task:deleted', { projectId, data: { id: taskId } as any });

    // Enqueue next available TODO task for the same agent
    if (assigneeId) {
      const next = await this.prisma.task.findFirst({
        where: { projectId, assigneeId, status: 'TODO', deletedAt: null },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });
      if (next) {
        const running = await this.prisma.agentRunLog.findFirst({
          where: { taskId: next.id, status: 'RUNNING' },
        });
        if (!running) await this.agentRunner.enqueue(next.id, assigneeId);
      }
    }

    return { deleted: true };
  }

  async listDeleted(projectId: string, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);
    return this.prisma.task.findMany({
      where: { projectId, deletedAt: { not: null } },
      select: { id: true, title: true, description: true, status: true, priority: true, deletedAt: true },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restoreTask(projectId: string, taskId: string, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, deletedAt: true },
    });
    if (!task || task.projectId !== projectId || !task.deletedAt) throw new NotFoundException('Deleted task not found');

    const restored = await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: null },
    });
    this.gateway.emit('task:created', { projectId, data: restored as any });
    return restored;
  }

  async permanentlyDeleteTask(projectId: string, taskId: string, actor: Actor) {
    await this.assertProjectAccess(projectId, actor);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, deletedAt: true },
    });
    if (!task || task.projectId !== projectId || !task.deletedAt) throw new NotFoundException('Deleted task not found');

    await this.prisma.task.delete({ where: { id: taskId } });
    return { deleted: true };
  }

  async findTaskForRun(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, assigneeId: true, status: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertProjectAccess(projectId: string, actor: Actor) {
    if (actor.type === 'agent') {
      if (actor.entity.projectId !== projectId) throw new ForbiddenException();
      return;
    }

    // For users, verify workspace membership
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: actor.entity.id } },
    });
    if (!member) throw new ForbiddenException();
  }
}
