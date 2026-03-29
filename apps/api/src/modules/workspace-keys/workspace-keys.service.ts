import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../keys/encryption.service';
import { UpsertWorkspaceKeyDto } from './dto/workspace-key.dto';
import type { User } from '@prisma/client';

const ALLOWED_PROVIDERS = ['openai', 'anthropic', 'gemini', 'custom', 'e2b_sandbox'];

@Injectable()
export class WorkspaceKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async upsert(workspaceId: string, dto: UpsertWorkspaceKeyDto, user: User) {
    await this.assertWorkspaceOwner(workspaceId, user.id);
    if (!ALLOWED_PROVIDERS.includes(dto.provider)) {
      throw new NotFoundException(`Unknown provider: ${dto.provider}`);
    }

    const encryptedKey = this.encryption.encrypt(dto.apiKey);

    return this.prisma.workspaceProviderKey.upsert({
      where: { workspaceId_provider: { workspaceId, provider: dto.provider } },
      create: { workspaceId, provider: dto.provider, label: dto.label, encryptedKey },
      update: { encryptedKey, label: dto.label },
      select: { id: true, provider: true, label: true, createdAt: true, updatedAt: true },
    });
  }

  async list(workspaceId: string, user: User) {
    await this.assertWorkspaceMember(workspaceId, user.id);

    return this.prisma.workspaceProviderKey.findMany({
      where: { workspaceId },
      select: { id: true, provider: true, label: true, createdAt: true, updatedAt: true },
      orderBy: { provider: 'asc' },
    });
  }

  async delete(workspaceId: string, provider: string, user: User) {
    await this.assertWorkspaceOwner(workspaceId, user.id);

    const key = await this.prisma.workspaceProviderKey.findUnique({
      where: { workspaceId_provider: { workspaceId, provider } },
    });
    if (!key) throw new NotFoundException('Provider key not found');

    return this.prisma.workspaceProviderKey.delete({
      where: { workspaceId_provider: { workspaceId, provider } },
    });
  }

  /** Internal: resolve API key for a provider in a workspace (used by agent runner) */
  async resolveApiKey(workspaceId: string, provider: string): Promise<string | null> {
    const record = await this.prisma.workspaceProviderKey.findUnique({
      where: { workspaceId_provider: { workspaceId, provider } },
    });
    if (!record) return null;
    return this.encryption.decrypt(record.encryptedKey);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertWorkspaceOwner(workspaceId: string, userId: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) throw new NotFoundException('Workspace not found');
    if (ws.ownerId !== userId) throw new ForbiddenException('Only the workspace owner can manage API keys');
    return ws;
  }

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException();
  }
}
