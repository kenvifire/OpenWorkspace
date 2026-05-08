import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SetCoordinatorDto } from './dto/coordinator.dto';
import type { User } from '@prisma/client';

export const COORDINATOR_STREAM = 'coordinator-events';

@Injectable()
export class CoordinatorService {
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD') || undefined,
    });
  }

  async setCoordinator(projectId: string, dto: SetCoordinatorDto, user: User) {
    await this.assertProjectLeader(projectId, user.id);

    const pa = await this.prisma.projectAgent.findUnique({
      where: { id: dto.projectAgentId },
      include: { agent: { select: { type: true } } },
    });
    if (!pa || pa.projectId !== projectId)
      throw new NotFoundException('ProjectAgent not found in this project');
    if (pa.agent.type !== 'AI')
      throw new BadRequestException('Only AI agents can be used as coordinators');

    return this.prisma.project.update({
      where: { id: projectId },
      data: { coordinatorProjectAgentId: dto.projectAgentId },
      select: { id: true, coordinatorProjectAgentId: true },
    });
  }

  async unsetCoordinator(projectId: string, user: User) {
    await this.assertProjectLeader(projectId, user.id);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { coordinatorProjectAgentId: null },
      select: { id: true, coordinatorProjectAgentId: true },
    });
  }

  async publish(
    projectId: string,
    triggerTaskId: string,
    triggerEvent: 'TASK_DONE' | 'TASK_BLOCKED' | 'TASK_FAILED' | 'HUMAN_DONE',
    coordinatorProjectAgentId: string,
  ): Promise<void> {
    await this.redis.xadd(
      COORDINATOR_STREAM,
      '*',
      'projectId', projectId,
      'triggerTaskId', triggerTaskId,
      'triggerEvent', triggerEvent,
      'coordinatorProjectAgentId', coordinatorProjectAgentId,
    );
  }

  private async assertProjectLeader(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.leaderId !== userId) throw new ForbiddenException('Only the project leader can manage the coordinator');
  }
}
