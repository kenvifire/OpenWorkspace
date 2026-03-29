import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { User, WorkspaceMemberRole } from '@prisma/client';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkspaceDto, owner: User) {
    const existing = await this.prisma.workspace.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('Workspace slug is already taken');
    }

    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        ownerId: owner.id,
        members: {
          create: { userId: owner.id, role: WorkspaceMemberRole.OWNER },
        },
      },
      include: { members: true },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: { _count: { select: { members: true, projects: true } } },
    });
  }

  async findOne(slug: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      include: {
        members: { include: { user: true } },
        _count: { select: { projects: true } },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const isMember = workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException();

    return workspace;
  }

  async inviteMember(workspaceId: string, dto: InviteMemberDto, requesterId: string) {
    await this.assertOwner(workspaceId, requesterId);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('No user found with that email address');

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: dto.role },
      include: { user: true },
    });
  }

  async removeMember(workspaceId: string, memberId: string, requesterId: string) {
    await this.assertOwner(workspaceId, requesterId);

    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: memberId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    return this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: memberId } },
    });
  }

  private async assertOwner(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member || member.role !== WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Only workspace owners can perform this action');
    }
  }
}
