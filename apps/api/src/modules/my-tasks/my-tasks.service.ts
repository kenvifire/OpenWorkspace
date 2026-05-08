import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MyTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(userId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { userId },
      select: { id: true, projectAgents: { select: { id: true } } },
    });

    const projectAgentIds = agents.flatMap((a) => a.projectAgents.map((pa) => pa.id));
    if (projectAgentIds.length === 0) return [];

    return this.prisma.task.findMany({
      where: { assigneeId: { in: projectAgentIds }, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            workspace: { select: { slug: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
