import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export const AGENT_RUN_STREAM = 'agent-runs';

@Injectable()
export class AgentRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentRunnerService.name);
  private redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD') || undefined,
    });
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  /**
   * Enqueue an agent run for a task.
   * Creates an AgentRunLog entry and pushes a job to the Redis Stream.
   */
  async enqueue(taskId: string, projectAgentId: string): Promise<void> {
    const projectAgent = await this.prisma.projectAgent.findUnique({
      where: { id: projectAgentId },
      include: { project: { select: { workspaceId: true } } },
    });
    if (!projectAgent) throw new NotFoundException('ProjectAgent not found');

    const runLog = await this.prisma.agentRunLog.create({
      data: {
        taskId,
        agentId: projectAgent.agentId,
        projectAgentId,
        status: 'RUNNING',
      },
    });

    await this.redis.xadd(
      AGENT_RUN_STREAM,
      '*',
      'taskId', taskId,
      'agentId', projectAgent.agentId,
      'projectAgentId', projectAgentId,
      'projectId', projectAgent.projectId,
      'workspaceId', projectAgent.project.workspaceId,
      'runLogId', runLog.id,
    );

    this.logger.log(`Enqueued agent run ${runLog.id} for task ${taskId} via Redis Stream`);
  }

  /**
   * Stop a running agent run by marking the log as STOPPED.
   * The runner polls this status and exits the loop gracefully.
   */
  async stop(taskId: string): Promise<void> {
    const runLog = await this.prisma.agentRunLog.findFirst({
      where: { taskId, status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });
    if (!runLog) return;

    await this.prisma.agentRunLog.update({
      where: { id: runLog.id },
      data: { status: 'STOPPED', finishedAt: new Date() },
    });
  }

  async getRunLogs(taskId: string) {
    return this.prisma.agentRunLog.findMany({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getRunLogsByProjectAgent(projectAgentId: string) {
    return this.prisma.agentRunLog.findMany({
      where: { projectAgentId },
      orderBy: { startedAt: 'desc' },
      include: {
        task: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async getRunLog(runLogId: string) {
    const log = await this.prisma.agentRunLog.findUnique({ where: { id: runLogId } });
    if (!log) throw new NotFoundException('Run log not found');
    return log;
  }

  /**
   * Wake (resume) a failed or stopped run from its saved conversation state.
   * Re-enqueues the job to the Redis Stream with wake=true so the runner
   * picks up where it left off rather than starting from scratch.
   */
  async wake(runLogId: string): Promise<void> {
    const runLog = await this.prisma.agentRunLog.findUnique({
      where: { id: runLogId },
      include: { projectAgent: { include: { project: { select: { workspaceId: true } } } } },
    });
    if (!runLog) throw new NotFoundException('Run log not found');

    const wakeableStatuses = ['FAILED', 'STOPPED', 'MAX_ITERATIONS'];
    if (!wakeableStatuses.includes(runLog.status)) {
      throw new Error(`Run ${runLogId} is in status ${runLog.status} and cannot be woken`);
    }

    await this.prisma.agentRunLog.update({
      where: { id: runLogId },
      data: { status: 'RUNNING', finishedAt: null },
    });

    await this.redis.xadd(
      AGENT_RUN_STREAM,
      '*',
      'taskId', runLog.taskId,
      'agentId', runLog.agentId,
      'projectAgentId', runLog.projectAgentId,
      'projectId', runLog.projectAgent.projectId,
      'workspaceId', runLog.projectAgent.project.workspaceId,
      'runLogId', runLogId,
      'wake', 'true',
    );

    this.logger.log(`Woke run ${runLogId} for task ${runLog.taskId} via Redis Stream`);
  }
}
