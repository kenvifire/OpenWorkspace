import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplaceSearchDto } from './dto/search.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: MarketplaceSearchDto) {
    const { search, type, pricingModel, tags, minRating, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.AgentWhereInput = {
      isPublished: true,
      ...(type && { type }),
      ...(pricingModel && { pricingModel }),
      ...(minRating && { aggregateRating: { gte: minRating } }),
      ...(tags?.length && { capabilityTags: { hasEvery: tags } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { capabilityTags: { has: search } },
        ],
      }),
    };

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          pricingModel: true,
          pricePerJob: true,
          pricePerToken: true,
          capabilityTags: true,
          aggregateRating: true,
          reviewCount: true,
          provider: {
            select: { id: true, displayName: true },
          },
        },
        orderBy: [{ aggregateRating: 'desc' }, { reviewCount: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      data: agents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAgent(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId, isPublished: true },
      include: {
        provider: { select: { id: true, displayName: true, bio: true } },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { projectAgents: true } },
      },
    });

    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async getCapabilityTags() {
    // Returns all distinct tags across published agents — useful for filter UI
    const agents = await this.prisma.agent.findMany({
      where: { isPublished: true },
      select: { capabilityTags: true },
    });

    const tags = new Set<string>();
    for (const agent of agents) {
      for (const tag of agent.capabilityTags) tags.add(tag);
    }

    return Array.from(tags).sort();
  }
}
