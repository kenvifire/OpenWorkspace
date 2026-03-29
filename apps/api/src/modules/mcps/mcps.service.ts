import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMcpDto, UpdateMcpDto } from './dto/mcp.dto';
import type { User } from '@prisma/client';

@Injectable()
export class McpsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMcps(user: User) {
    return this.prisma.mcp.findMany({
      where: { userId: user.id },
      include: { _count: { select: { agents: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMcp(dto: CreateMcpDto, user: User) {
    return this.prisma.mcp.create({
      data: {
        userId: user.id,
        name: dto.name,
        description: dto.description,
        transport: dto.transport ?? 'SSE',
        url: dto.url,
        command: dto.command,
        args: dto.args ?? [],
        headers: dto.headers,
      },
    });
  }

  async getMcp(mcpId: string, user: User) {
    const mcp = await this.prisma.mcp.findUnique({ where: { id: mcpId } });
    if (!mcp || mcp.userId !== user.id) throw new NotFoundException('MCP not found');
    return mcp;
  }

  async updateMcp(mcpId: string, dto: UpdateMcpDto, user: User) {
    const mcp = await this.prisma.mcp.findUnique({ where: { id: mcpId } });
    if (!mcp || mcp.userId !== user.id) throw new NotFoundException('MCP not found');
    return this.prisma.mcp.update({ where: { id: mcpId }, data: dto });
  }

  async deleteMcp(mcpId: string, user: User) {
    const mcp = await this.prisma.mcp.findUnique({ where: { id: mcpId } });
    if (!mcp || mcp.userId !== user.id) throw new NotFoundException('MCP not found');
    return this.prisma.mcp.delete({ where: { id: mcpId } });
  }

  async assignMcp(agentId: string, mcpId: string, user: User) {
    const [agent, mcp] = await Promise.all([
      this.prisma.agent.findUnique({ where: { id: agentId } }),
      this.prisma.mcp.findUnique({ where: { id: mcpId } }),
    ]);
    if (!agent || agent.userId !== user.id) throw new NotFoundException('Agent not found');
    if (!mcp || mcp.userId !== user.id) throw new NotFoundException('MCP not found');

    return this.prisma.agentMcp.upsert({
      where: { agentId_mcpId: { agentId, mcpId } },
      create: { agentId, mcpId },
      update: {},
    });
  }

  async removeMcp(agentId: string, mcpId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) throw new ForbiddenException('Agent not found');
    await this.prisma.agentMcp.deleteMany({ where: { agentId, mcpId } });
  }

  async listAgentMcps(agentId: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) throw new NotFoundException('Agent not found');
    return this.prisma.agentMcp.findMany({
      where: { agentId },
      include: { mcp: true },
    });
  }

  // ─── ProjectAgent ↔ MCP assignment ────────────────────────────────────────

  async listProjectAgentMcps(projectAgentId: string) {
    return this.prisma.projectAgentMcp.findMany({
      where: { projectAgentId },
      include: { mcp: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  async assignProjectAgentMcp(projectAgentId: string, mcpId: string, user: User) {
    const mcp = await this.prisma.mcp.findUnique({ where: { id: mcpId } });
    if (!mcp || mcp.userId !== user.id) throw new NotFoundException('MCP not found');

    return this.prisma.projectAgentMcp.upsert({
      where: { projectAgentId_mcpId: { projectAgentId, mcpId } },
      create: { projectAgentId, mcpId },
      update: {},
    });
  }

  async removeProjectAgentMcp(projectAgentId: string, mcpId: string) {
    await this.prisma.projectAgentMcp.deleteMany({ where: { projectAgentId, mcpId } });
  }
}
