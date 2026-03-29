import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';
import type { User } from '@prisma/client';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSkills(user: User) {
    return this.prisma.skill.findMany({
      where: { userId: user.id },
      include: { _count: { select: { agents: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSkill(dto: CreateSkillDto, user: User) {
    return this.prisma.skill.create({
      data: {
        userId: user.id,
        name: dto.name,
        description: dto.description,
        instructions: dto.instructions,
        type: dto.type ?? 'PROMPT',
        webhookUrl: dto.webhookUrl,
        webhookMethod: dto.webhookMethod,
        webhookHeaders: dto.webhookHeaders,
      },
    });
  }

  async getSkill(skillId: string, user: User) {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill || skill.userId !== user.id) throw new NotFoundException('Skill not found');
    return skill;
  }

  async updateSkill(skillId: string, dto: UpdateSkillDto, user: User) {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill || skill.userId !== user.id) throw new NotFoundException('Skill not found');
    return this.prisma.skill.update({ where: { id: skillId }, data: dto });
  }

  async deleteSkill(skillId: string, user: User) {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill || skill.userId !== user.id) throw new NotFoundException('Skill not found');
    return this.prisma.skill.delete({ where: { id: skillId } });
  }

  // ─── Agent ↔ Skill assignment ─────────────────────────────────────────────

  async assignSkill(agentId: string, skillId: string, user: User) {
    const [agent, skill] = await Promise.all([
      this.prisma.agent.findUnique({ where: { id: agentId } }),
      this.prisma.skill.findUnique({ where: { id: skillId } }),
    ]);
    if (!agent || agent.userId !== user.id) throw new NotFoundException('Agent not found');
    if (!skill || skill.userId !== user.id) throw new NotFoundException('Skill not found');

    return this.prisma.agentSkill.upsert({
      where: { agentId_skillId: { agentId, skillId } },
      create: { agentId, skillId },
      update: {},
    });
  }

  async removeSkill(agentId: string, skillId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) throw new ForbiddenException('Agent not found');

    await this.prisma.agentSkill.deleteMany({ where: { agentId, skillId } });
  }

  async listAgentSkills(agentId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) throw new NotFoundException('Agent not found');

    return this.prisma.agentSkill.findMany({
      where: { agentId },
      include: { skill: true },
    });
  }

  // ─── ProjectAgent ↔ Skill assignment ──────────────────────────────────────

  async listProjectAgentSkills(projectAgentId: string) {
    return this.prisma.projectAgentSkill.findMany({
      where: { projectAgentId },
      include: { skill: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  async assignProjectAgentSkill(projectAgentId: string, skillId: string, user: User) {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill || skill.userId !== user.id) throw new NotFoundException('Skill not found');

    return this.prisma.projectAgentSkill.upsert({
      where: { projectAgentId_skillId: { projectAgentId, skillId } },
      create: { projectAgentId, skillId },
      update: {},
    });
  }

  async removeProjectAgentSkill(projectAgentId: string, skillId: string) {
    await this.prisma.projectAgentSkill.deleteMany({ where: { projectAgentId, skillId } });
  }
}
