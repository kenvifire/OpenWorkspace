import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { HireAgentDto, AcceptAgreementDto } from './dto/hire-agent.dto';
import { User, AgentType, ProjectAgreementType } from '@prisma/client';
import * as crypto from 'crypto';

const CURRENT_DPA_VERSION = '1.0';
const PLATFORM_DEFAULT_NDA_VERSION = '1.0';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateProjectDto, leader: User) {
    await this.assertWorkspaceMember(workspaceId, leader.id);

    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description,
        leaderId: leader.id,
      },
    });

    // Auto-create the built-in planning agent for this project
    await this.prisma.projectPlanningAgent.create({
      data: { projectId: project.id },
    });

    return project;
  }

  async findAll(workspaceId: string, userId: string) {
    await this.assertWorkspaceMember(workspaceId, userId);

    return this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        leader: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
        projectAgents: {
          where: { revokedAt: null },
          select: { agent: { select: { type: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        leader: { select: { id: true, name: true, avatarUrl: true } },
        projectAgents: {
          where: { revokedAt: null },
          include: {
            agent: { select: { id: true, name: true, type: true } },
            agreement: { select: { agreementType: true, acceptedAt: true } },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    await this.assertWorkspaceMember(project.workspaceId, userId);

    return project;
  }

  async listAgents(projectId: string, userId: string) {
    const project = await this.getProjectOrThrow(projectId);
    await this.assertWorkspaceMember(project.workspaceId, userId);

    return this.prisma.projectAgent.findMany({
      where: { projectId },
      include: {
        agent: {
          select: {
            id: true, name: true, type: true,
            provider: { select: { id: true, displayName: true } },
          },
        },
        agreement: { select: { id: true, acceptedAt: true, agreementType: true } },
      },
      orderBy: { hiredAt: 'asc' },
    });
  }

  async update(projectId: string, dto: UpdateProjectDto, userId: string) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.leaderId !== userId) throw new ForbiddenException('Only the project leader can update the project');

    return this.prisma.project.update({
      where: { id: projectId },
      data: dto,
    });
  }

  /**
   * Step 1: Hire an agent — creates the ProjectAgent record and returns the
   * raw Project Key (shown only once) along with the agreement to be signed.
   * The key is stored as a SHA-256 hash; only the raw key is returned here.
   */
  async hireAgent(projectId: string, dto: HireAgentDto, leader: User) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.leaderId !== leader.id) throw new ForbiddenException('Only the project leader can hire agents');

    const agent = await this.prisma.agent.findUnique({
      where: { id: dto.agentId },
      include: { provider: true },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const isPersonalAgent = agent.userId === leader.id;

    if (!isPersonalAgent) {
      // Marketplace agents must be published
      if (!agent.isPublished) throw new BadRequestException('Agent is not published on the Marketplace');

      // For AI marketplace agents, verify the provider has an active DPA
      if (agent.type === AgentType.AI) {
        if (!agent.provider?.activeDpaVersion) {
          throw new ForbiddenException('Agent provider has not accepted the platform DPA');
        }
      }
    }

    const rawKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const agreementType = project.customNdaFileKey
      ? ProjectAgreementType.CUSTOM_NDA
      : ProjectAgreementType.PLATFORM_DEFAULT;

    // For personal agents, auto-accept the agreement in one transaction
    if (isPersonalAgent) {
      const projectAgent = await this.prisma.$transaction(async (tx) => {
        const pa = await tx.projectAgent.create({
          data: {
            projectId,
            agentId: dto.agentId,
            role: dto.role,
            customRole: dto.customRole,
            isCoordinator: dto.isCoordinator ?? false,
            projectKey: hashedKey,
            hiredById: leader.id,
          },
        });

        await tx.projectAgreement.create({
          data: {
            projectAgentId: pa.id,
            agreementType,
            acceptedAt: new Date(),
            acceptedById: leader.id,
            acceptedByType: 'user',
            dpaVersionInEffect: CURRENT_DPA_VERSION,
          },
        });

        return pa;
      });

      return {
        projectAgentId: projectAgent.id,
        rawProjectKey: rawKey,
        agreementType,
        customNdaFileKey: project.customNdaFileKey ?? null,
        dpaVersionInEffect: CURRENT_DPA_VERSION,
        message: 'Personal agent added to the project and agreement auto-accepted.',
      };
    }

    const projectAgent = await this.prisma.projectAgent.create({
      data: {
        projectId,
        agentId: dto.agentId,
        role: dto.role,
        customRole: dto.customRole,
        isCoordinator: dto.isCoordinator ?? false,
        projectKey: hashedKey,
        hiredById: leader.id,
      },
    });

    return {
      projectAgentId: projectAgent.id,
      rawProjectKey: rawKey, // returned once — provider/human must store this
      agreementType,
      customNdaFileKey: project.customNdaFileKey ?? null,
      dpaVersionInEffect: CURRENT_DPA_VERSION,
      message:
        agent.type === AgentType.HUMAN
          ? 'A signature request will be sent to the agent. The project key activates after signing.'
          : 'The agent provider must call POST /projects/:id/agents/:agentId/accept-agreement to activate the key.',
    };
  }

  /**
   * Step 2: Accept the project agreement — activates the project key.
   * For AI agents: called by the provider (authenticated as a user who owns the provider).
   * For human agents: called after DocuSign returns the signed envelope.
   */
  async acceptAgreement(
    projectId: string,
    projectAgentId: string,
    dto: AcceptAgreementDto,
    acceptor: User,
    ipAddress: string,
  ) {
    const projectAgent = await this.prisma.projectAgent.findUnique({
      where: { id: projectAgentId },
      include: { agent: { include: { provider: true } }, project: true },
    });

    if (!projectAgent || projectAgent.projectId !== projectId) {
      throw new NotFoundException('ProjectAgent not found');
    }

    const isHuman = projectAgent.agent.type === AgentType.HUMAN;

    // For AI agents, verify the acceptor is the agent's provider owner
    if (!isHuman) {
      if (!projectAgent.agent.provider || projectAgent.agent.provider.userId !== acceptor.id) {
        throw new ForbiddenException('Only the agent provider can accept the agreement for an AI agent');
      }
    }

    const existing = await this.prisma.projectAgreement.findUnique({
      where: { projectAgentId },
    });
    if (existing) throw new BadRequestException('Agreement already accepted');

    const agreementType = projectAgent.project.customNdaFileKey
      ? ProjectAgreementType.CUSTOM_NDA
      : ProjectAgreementType.PLATFORM_DEFAULT;

    return this.prisma.projectAgreement.create({
      data: {
        projectAgentId,
        agreementType,
        customNdaFileKey: projectAgent.project.customNdaFileKey,
        acceptedById: isHuman ? acceptor.id : (projectAgent.agent.provider?.id ?? acceptor.id),
        acceptedByType: isHuman ? 'user' : 'provider',
        signatureRef: dto.signatureRef,
        dpaVersionInEffect: CURRENT_DPA_VERSION,
      },
    });
  }

  async removeAgent(projectId: string, projectAgentId: string, leader: User) {
    const project = await this.getProjectOrThrow(projectId);
    if (project.leaderId !== leader.id) throw new ForbiddenException();

    return this.prisma.projectAgent.update({
      where: { id: projectAgentId },
      data: { revokedAt: new Date() },
    });
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
  }
}
