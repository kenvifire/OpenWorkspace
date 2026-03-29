import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../keys/encryption.service';
import { CreateProviderDto, UpdateProviderDto, AcceptDpaDto } from './dto/provider.dto';
import { CreateAgentDto, UpdateAgentDto, RespondToReviewDto, CreateReviewDto } from './dto/agent.dto';
import { CreatePersonalAgentDto, UpdatePersonalAgentDto } from './dto/personal-agent.dto';
import type { User } from '@prisma/client';

const CURRENT_DPA_VERSION = '1.0';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // ─── Provider ─────────────────────────────────────────────────────────────

  async registerProvider(dto: CreateProviderDto, user: User) {
    const existing = await this.prisma.agentProvider.findUnique({
      where: { userId: user.id },
    });
    if (existing) throw new ConflictException('You already have a provider account');

    return this.prisma.agentProvider.create({
      data: { userId: user.id, displayName: dto.displayName, bio: dto.bio },
    });
  }

  async getMyProvider(user: User) {
    const provider = await this.prisma.agentProvider.findUnique({
      where: { userId: user.id },
      include: {
        _count: { select: { agents: true } },
        dpaAcceptances: { orderBy: { acceptedAt: 'desc' }, take: 1 },
      },
    });
    if (!provider) throw new NotFoundException('You do not have a provider account');
    return provider;
  }

  async updateProvider(dto: UpdateProviderDto, user: User) {
    const provider = await this.getProviderOrThrow(user.id);
    return this.prisma.agentProvider.update({
      where: { id: provider.id },
      data: dto,
    });
  }

  async acceptDpa(dto: AcceptDpaDto, user: User, ipAddress: string) {
    const provider = await this.getProviderOrThrow(user.id);

    if (dto.dpaVersion !== CURRENT_DPA_VERSION) {
      throw new BadRequestException(
        `Must accept the current DPA version (${CURRENT_DPA_VERSION})`,
      );
    }

    const [acceptance] = await this.prisma.$transaction([
      this.prisma.providerDpaAcceptance.create({
        data: { providerId: provider.id, dpaVersion: dto.dpaVersion, ipAddress },
      }),
      this.prisma.agentProvider.update({
        where: { id: provider.id },
        data: { activeDpaVersion: dto.dpaVersion },
      }),
    ]);

    return acceptance;
  }

  // ─── Agents ───────────────────────────────────────────────────────────────

  async createAgent(dto: CreateAgentDto, user: User) {
    const provider = await this.getProviderOrThrow(user.id);
    this.validatePricing(dto);

    const encryptedApiKey = dto.apiKey ? this.encryption.encrypt(dto.apiKey) : undefined;

    return this.prisma.agent.create({
      data: {
        providerId: provider.id,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        pricingModel: dto.pricingModel,
        pricePerJob: dto.pricePerJob,
        pricePerToken: dto.pricePerToken,
        capabilityTags: dto.capabilityTags,
        llmProvider: dto.llmProvider,
        modelName: dto.modelName,
        systemPrompt: dto.systemPrompt,
        encryptedApiKey,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        maxIterations: dto.maxIterations,
        enabledTools: dto.enabledTools ?? [],
      },
    });
  }

  async listMyAgents(user: User) {
    const provider = await this.getProviderOrThrow(user.id);
    return this.prisma.agent.findMany({
      where: { providerId: provider.id },
      include: {
        _count: { select: { reviews: true, projectAgents: true } },
        versions: { orderBy: { versionNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyAgent(agentId: string, user: User) {
    const agent = await this.getAgentOrThrow(agentId);
    await this.assertOwnsAgent(agent, user.id);
    return agent;
  }

  async updateAgent(agentId: string, dto: UpdateAgentDto, user: User) {
    const agent = await this.getAgentOrThrow(agentId);
    await this.assertOwnsAgent(agent, user.id);
    if (dto.pricingModel || dto.pricePerJob || dto.pricePerToken) {
      this.validatePricing({ ...agent, ...dto } as any);
    }

    const { apiKey, ...rest } = dto;
    const encryptedApiKey = apiKey ? this.encryption.encrypt(apiKey) : undefined;

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { ...rest, ...(encryptedApiKey ? { encryptedApiKey } : {}) },
    });
  }

  async deleteAgent(agentId: string, user: User) {
    const agent = await this.getAgentOrThrow(agentId);
    await this.assertOwnsAgent(agent, user.id);

    const activeHires = await this.prisma.projectAgent.count({
      where: { agentId, revokedAt: null },
    });
    if (activeHires > 0) {
      throw new ForbiddenException(
        'Cannot delete an agent that is currently active in projects. Remove it from all projects first.',
      );
    }

    return this.prisma.agent.delete({ where: { id: agentId } });
  }

  async publishAgent(agentId: string, user: User) {
    const agent = await this.getAgentOrThrow(agentId);
    await this.assertOwnsAgent(agent, user.id);

    const provider = await this.getProviderOrThrow(user.id);

    if (!provider.kycVerified) {
      throw new ForbiddenException(
        'Identity verification (KYC) must be completed before publishing agents',
      );
    }
    if (!provider.activeDpaVersion) {
      throw new ForbiddenException(
        'You must accept the platform Data Processing Agreement before publishing agents',
      );
    }

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { isPublished: true },
    });
  }

  async unpublishAgent(agentId: string, user: User) {
    const agent = await this.getAgentOrThrow(agentId);
    await this.assertOwnsAgent(agent, user.id);

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { isPublished: false },
    });
  }

  // ─── Personal Agents ──────────────────────────────────────────────────────

  async createPersonalAgent(dto: CreatePersonalAgentDto, user: User) {
    const encryptedApiKey = dto.apiKey ? this.encryption.encrypt(dto.apiKey) : undefined;

    return this.prisma.agent.create({
      data: {
        userId: user.id,
        name: dto.name,
        description: dto.description ?? '',
        llmProvider: dto.llmProvider,
        modelName: dto.modelName,
        systemPrompt: dto.systemPrompt,
        encryptedApiKey,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        maxIterations: dto.maxIterations,
        enabledTools: dto.enabledTools ?? [],
      },
    });
  }

  async listPersonalAgents(user: User) {
    return this.prisma.agent.findMany({
      where: { userId: user.id },
      include: {
        _count: { select: { projectAgents: true } },
        versions: { orderBy: { versionNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPersonalAgent(agentId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) throw new NotFoundException('Agent not found');
    return agent;
  }

  async updatePersonalAgent(agentId: string, dto: UpdatePersonalAgentDto, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) throw new NotFoundException('Agent not found');

    const { apiKey, ...rest } = dto;
    const encryptedApiKey = apiKey ? this.encryption.encrypt(apiKey) : undefined;

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { ...rest, ...(encryptedApiKey ? { encryptedApiKey } : {}) },
    });
  }

  async deletePersonalAgent(agentId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) throw new NotFoundException('Agent not found');

    const activeHires = await this.prisma.projectAgent.count({
      where: { agentId, revokedAt: null },
    });
    if (activeHires > 0) {
      throw new ForbiddenException(
        'Cannot delete an agent that is active in projects. Remove it from all projects first.',
      );
    }

    return this.prisma.agent.delete({ where: { id: agentId } });
  }

  // ─── Agent Versions ───────────────────────────────────────────────────────

  private async getAgentAndVerifyOwner(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { provider: true, versions: { orderBy: { versionNumber: 'asc' } } },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const ownerUserId = agent.provider?.userId ?? agent.userId;
    if (ownerUserId !== userId) throw new ForbiddenException('You do not own this agent');

    return agent;
  }

  async listAgentVersions(agentId: string, user: User) {
    const agent = await this.getAgentAndVerifyOwner(agentId, user.id);
    return { versions: agent.versions, activeVersionId: agent.activeVersionId };
  }

  async publishAgentVersion(agentId: string, user: User, label?: string) {
    const agent = await this.getAgentAndVerifyOwner(agentId, user.id);

    if (agent.versions.length >= 3) {
      throw new BadRequestException('Maximum of 3 versions allowed per agent. Delete one before publishing a new version.');
    }

    const nextNumber = agent.versions.length + 1;

    await this.prisma.agentVersion.create({
      data: {
        agentId,
        versionNumber: nextNumber,
        label: label ?? null,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        llmProvider: agent.llmProvider,
        modelName: agent.modelName,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        maxIterations: agent.maxIterations,
        enabledTools: agent.enabledTools,
      },
    });

    return this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
  }

  async deleteAgentVersion(agentId: string, versionId: string, user: User) {
    const agent = await this.getAgentAndVerifyOwner(agentId, user.id);

    const version = agent.versions.find((v) => v.id === versionId);
    if (!version) throw new NotFoundException('Version not found');

    await this.prisma.agentVersion.delete({ where: { id: versionId } });

    // Renumber remaining versions
    const remaining = agent.versions
      .filter((v) => v.id !== versionId)
      .sort((a, b) => a.versionNumber - b.versionNumber);

    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.agentVersion.update({
        where: { id: remaining[i].id },
        data: { versionNumber: i + 1 },
      });
    }

    // Clear activeVersionId if it pointed to the deleted version
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { activeVersionId: agent.activeVersionId === versionId ? null : agent.activeVersionId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });

    return updatedAgent;
  }

  async activateAgentVersion(agentId: string, versionId: string | null, user: User) {
    const agent = await this.getAgentAndVerifyOwner(agentId, user.id);

    if (versionId && !agent.versions.find((v) => v.id === versionId)) {
      throw new NotFoundException('Version not found');
    }

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { activeVersionId: versionId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
  }

  // ─── Reviews ──────────────────────────────────────────────────────────────

  async getReviews(agentId: string, page = 1, limit = 20) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.agentReview.findMany({
        where: { agentId },
        include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.agentReview.count({ where: { agentId } }),
    ]);

    return {
      data: reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregateRating: agent.aggregateRating,
      reviewCount: agent.reviewCount,
    };
  }

  async createReview(agentId: string, projectId: string, dto: CreateReviewDto, reviewer: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');

    // Verify the reviewer was part of the project
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const isMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: reviewer.id } },
    });
    if (!isMember) throw new ForbiddenException('You must have been part of the project to leave a review');

    // Verify the agent was hired into this project
    const hire = await this.prisma.projectAgent.findFirst({
      where: { agentId, projectId },
    });
    if (!hire) throw new ForbiddenException('This agent was not hired in the specified project');

    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agentReview.create({
        data: {
          agentId,
          projectId,
          reviewerId: reviewer.id,
          rating: dto.rating,
          comment: dto.comment,
        },
      });

      // Recompute aggregate rating
      const agg = await tx.agentReview.aggregate({
        where: { agentId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.agent.update({
        where: { id: agentId },
        data: {
          aggregateRating: agg._avg.rating,
          reviewCount: agg._count.rating,
        },
      });

      return created;
    });

    return review;
  }

  async respondToReview(reviewId: string, dto: RespondToReviewDto, user: User) {
    const review = await this.prisma.agentReview.findUnique({
      where: { id: reviewId },
      include: { agent: { include: { provider: true } } },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (!review.agent.provider || review.agent.provider.userId !== user.id) {
      throw new ForbiddenException('Only the agent provider can respond to reviews');
    }
    if (review.providerResponse) {
      throw new ConflictException('You have already responded to this review');
    }

    return this.prisma.agentReview.update({
      where: { id: reviewId },
      data: { providerResponse: dto.response },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getProviderOrThrow(userId: string) {
    const provider = await this.prisma.agentProvider.findUnique({ where: { userId } });
    if (!provider) throw new NotFoundException('Provider account not found. Register as a provider first.');
    return provider;
  }

  private async getAgentOrThrow(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { provider: true },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  private async assertOwnsAgent(
    agent: { provider: { userId: string } | null; userId?: string | null },
    userId: string,
  ) {
    const ownerUserId = agent.provider?.userId ?? agent.userId;
    if (ownerUserId !== userId) {
      throw new ForbiddenException('You do not own this agent');
    }
  }

  private validatePricing(dto: { pricingModel: string; pricePerJob?: number; pricePerToken?: number }) {
    if (dto.pricingModel === 'PER_JOB' && !dto.pricePerJob) {
      throw new BadRequestException('pricePerJob is required for PER_JOB pricing');
    }
    if (dto.pricingModel === 'PER_TOKEN' && !dto.pricePerToken) {
      throw new BadRequestException('pricePerToken is required for PER_TOKEN pricing');
    }
  }
}
