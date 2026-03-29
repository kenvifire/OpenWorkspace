import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { CreateResourceKeyDto } from './dto/key.dto';
import type { User, ProjectAgent } from '@prisma/client';

@Injectable()
export class KeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // ─── Human endpoints ──────────────────────────────────────────────────────

  async create(projectId: string, dto: CreateResourceKeyDto, user: User) {
    await this.assertProjectLeader(projectId, user.id);

    const encryptedValue = this.encryption.encrypt(dto.value);

    return this.prisma.resourceKey.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        encryptedValue,
        createdById: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        createdById: true,
        // value intentionally omitted
      },
    });
  }

  async list(projectId: string, user: User) {
    await this.assertProjectMember(projectId, user.id);

    return this.prisma.resourceKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        createdById: true,
        // encryptedValue intentionally omitted
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(projectId: string, keyId: string, user: User) {
    await this.assertProjectLeader(projectId, user.id);

    const key = await this.prisma.resourceKey.findUnique({ where: { id: keyId } });
    if (!key || key.projectId !== projectId) throw new NotFoundException('Resource key not found');

    return this.prisma.resourceKey.delete({ where: { id: keyId } });
  }

  // ─── Agent endpoint ───────────────────────────────────────────────────────

  /**
   * Returns the decrypted value of a single key to an authorized agent.
   * Requires: the agent is assigned to the project and has an active (non-revoked) key.
   * Every access is written to the AuditLog.
   */
  async getValueForAgent(projectId: string, keyId: string, agent: ProjectAgent & { project: { workspaceId: string } }) {
    if (agent.projectId !== projectId) throw new ForbiddenException();

    const key = await this.prisma.resourceKey.findUnique({ where: { id: keyId } });
    if (!key || key.projectId !== projectId) throw new NotFoundException('Resource key not found');

    await this.prisma.auditLog.create({
      data: {
        workspaceId: agent.project.workspaceId,
        projectId,
        actorId: agent.id,
        actorType: 'agent',
        action: 'READ_RESOURCE_KEY',
        resourceType: 'ResourceKey',
        resourceId: keyId,
      },
    });

    return {
      id: key.id,
      name: key.name,
      value: this.encryption.decrypt(key.encryptedValue),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertProjectLeader(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.leaderId !== userId) throw new ForbiddenException('Only the project leader can manage resource keys');
    return project;
  }

  private async assertProjectMember(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException();
  }
}
