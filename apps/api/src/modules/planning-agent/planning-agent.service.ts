import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../keys/encryption.service';
import type { User } from '@prisma/client';

export const BASE_PLANNING_PROMPT = `You are the Planning Agent for this project on OpenWorkspace. Your responsibilities:
- Analyze project goals and break them down into clear, actionable tasks
- Assign appropriate roles to each task based on required skills
- Define task priorities and acceptance criteria
- Generate structured project plans

When generating a plan, respond with valid JSON:
{"roles":[{"name":"string","description":"string"}],"tasks":[{"title":"string","role":"string","priority":"LOW|MEDIUM|HIGH|URGENT","description":"string"}]}`;

@Injectable()
export class PlanningAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private async assertAccess(projectId: string, user: User) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.leaderId !== user.id) throw new ForbiddenException('Not project leader');
    return project;
  }

  async getConfig(user: User) {
    return {
      basePrompt: BASE_PLANNING_PROMPT,
      userDefaultPrompt: user.planningAgentDefaultPrompt ?? '',
      provider: user.planningAgentProvider ?? null,
      model: user.planningAgentModel ?? null,
      hasApiKey: !!user.planningAgentEncryptedApiKey,
    };
  }

  async updateConfig(
    dto: { userDefaultPrompt?: string; provider?: string | null; model?: string | null; apiKey?: string | null },
    user: User,
  ) {
    const data: Record<string, any> = {};
    if (dto.userDefaultPrompt !== undefined) data.planningAgentDefaultPrompt = dto.userDefaultPrompt;
    if (dto.provider !== undefined) data.planningAgentProvider = dto.provider;
    if (dto.model !== undefined) data.planningAgentModel = dto.model;
    if (dto.apiKey !== undefined) {
      data.planningAgentEncryptedApiKey = dto.apiKey ? this.encryption.encrypt(dto.apiKey) : null;
    }
    const updated = await this.prisma.user.update({ where: { id: user.id }, data });
    return {
      basePrompt: BASE_PLANNING_PROMPT,
      userDefaultPrompt: updated.planningAgentDefaultPrompt ?? '',
      provider: updated.planningAgentProvider ?? null,
      model: updated.planningAgentModel ?? null,
      hasApiKey: !!updated.planningAgentEncryptedApiKey,
    };
  }

  async resolveApiKey(user: User, workspaceId: string): Promise<string | null> {
    if (user.planningAgentEncryptedApiKey) {
      return this.encryption.decrypt(user.planningAgentEncryptedApiKey);
    }
    if (!user.planningAgentProvider) return null;
    const wsk = await this.prisma.workspaceProviderKey.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: user.planningAgentProvider } },
    });
    return wsk ? this.encryption.decrypt(wsk.encryptedKey) : null;
  }

  async getOrCreate(projectId: string, user: User) {
    await this.assertAccess(projectId, user);
    let agent = await this.prisma.projectPlanningAgent.findUnique({
      where: { projectId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    if (!agent) {
      agent = await this.prisma.projectPlanningAgent.create({
        data: { projectId },
        include: { versions: { orderBy: { versionNumber: 'asc' } } },
      });
    }
    return { ...agent, basePrompt: BASE_PLANNING_PROMPT };
  }

  async updateCustomPrompt(projectId: string, customPrompt: string, user: User) {
    await this.assertAccess(projectId, user);
    const agent = await this.prisma.projectPlanningAgent.upsert({
      where: { projectId },
      create: { projectId, customPrompt },
      update: { customPrompt },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    return { ...agent, basePrompt: BASE_PLANNING_PROMPT };
  }

  async publishVersion(projectId: string, label: string | undefined, user: User) {
    await this.assertAccess(projectId, user);
    const agent = await this.prisma.projectPlanningAgent.upsert({
      where: { projectId },
      create: { projectId },
      update: {},
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });

    if (agent.versions.length >= 3) {
      throw new BadRequestException('Maximum of 3 versions allowed. Delete one to publish a new version.');
    }

    // Pick the next version number (fill gaps if any were deleted)
    const usedNumbers = new Set(agent.versions.map((v) => v.versionNumber));
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) nextNumber++;

    await this.prisma.planningAgentVersion.create({
      data: {
        planningAgentId: agent.id,
        versionNumber: nextNumber,
        label: label || `v${nextNumber}`,
        customPrompt: agent.customPrompt,
      },
    });

    const updated = await this.prisma.projectPlanningAgent.findUnique({
      where: { projectId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    return { ...updated, basePrompt: BASE_PLANNING_PROMPT };
  }

  async deleteVersion(projectId: string, versionId: string, user: User) {
    await this.assertAccess(projectId, user);
    const agent = await this.prisma.projectPlanningAgent.findUnique({ where: { projectId } });
    if (!agent) throw new NotFoundException('Planning agent not found');

    await this.prisma.planningAgentVersion.deleteMany({
      where: { id: versionId, planningAgentId: agent.id },
    });

    // Clear activeVersionId if it pointed to this version
    if (agent.activeVersionId === versionId) {
      await this.prisma.projectPlanningAgent.update({
        where: { id: agent.id },
        data: { activeVersionId: null },
      });
    }

    const updated = await this.prisma.projectPlanningAgent.findUnique({
      where: { projectId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    return { ...updated, basePrompt: BASE_PLANNING_PROMPT };
  }

  async activateVersion(projectId: string, versionId: string | null, user: User) {
    await this.assertAccess(projectId, user);
    const agent = await this.prisma.projectPlanningAgent.findUnique({
      where: { projectId },
      include: { versions: true },
    });
    if (!agent) throw new NotFoundException('Planning agent not found');

    if (versionId && !agent.versions.find((v) => v.id === versionId)) {
      throw new NotFoundException('Version not found');
    }

    const updated = await this.prisma.projectPlanningAgent.update({
      where: { projectId },
      data: { activeVersionId: versionId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    return { ...updated, basePrompt: BASE_PLANNING_PROMPT };
  }
}
