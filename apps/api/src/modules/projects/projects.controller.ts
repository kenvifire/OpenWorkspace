import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
  HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { HireAgentDto, AcceptAgreementDto } from './dto/hire-agent.dto';
import type { User } from '@prisma/client';
import type { Request } from 'express';

@ApiTags('projects')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.create(workspaceId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List projects in a workspace' })
  findAll(@Param('workspaceId') workspaceId: string, @CurrentUser() user: User) {
    return this.projectsService.findAll(workspaceId, user.id);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  findOne(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.projectsService.findOne(projectId, user.id);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project' })
  update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.update(projectId, dto, user.id);
  }

  @Get(':projectId/agents')
  @ApiOperation({ summary: 'List agents hired for a project' })
  listAgents(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.projectsService.listAgents(projectId, user.id);
  }

  @Post(':projectId/agents')
  @ApiOperation({
    summary: 'Hire an agent — returns a one-time project key and the agreement to sign',
  })
  hireAgent(
    @Param('projectId') projectId: string,
    @Body() dto: HireAgentDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.hireAgent(projectId, dto, user);
  }

  @Post(':projectId/agents/:projectAgentId/accept-agreement')
  @ApiOperation({
    summary: 'Accept project agreement — activates the project key',
  })
  acceptAgreement(
    @Param('projectId') projectId: string,
    @Param('projectAgentId') projectAgentId: string,
    @Body() dto: AcceptAgreementDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.projectsService.acceptAgreement(projectId, projectAgentId, dto, user, ip);
  }

  @Delete(':projectId/agents/:projectAgentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove agent from project (revokes project key)' })
  removeAgent(
    @Param('projectId') projectId: string,
    @Param('projectAgentId') projectAgentId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.removeAgent(projectId, projectAgentId, user);
  }
}
