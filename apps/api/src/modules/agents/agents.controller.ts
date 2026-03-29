import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Req, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgentsService } from './agents.service';
import { CreateProviderDto, UpdateProviderDto, AcceptDpaDto } from './dto/provider.dto';
import { CreateAgentDto, UpdateAgentDto, RespondToReviewDto, CreateReviewDto } from './dto/agent.dto';
import { CreatePersonalAgentDto, UpdatePersonalAgentDto } from './dto/personal-agent.dto';
import type { User } from '@prisma/client';
import type { Request } from 'express';

@ApiTags('agents')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller()
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  // ─── Provider endpoints ───────────────────────────────────────────────────

  @Post('providers')
  @ApiOperation({ summary: 'Register as an agent provider' })
  registerProvider(@Body() dto: CreateProviderDto, @CurrentUser() user: User) {
    return this.agentsService.registerProvider(dto, user);
  }

  @Get('providers/me')
  @ApiOperation({ summary: 'Get my provider profile' })
  getMyProvider(@CurrentUser() user: User) {
    return this.agentsService.getMyProvider(user);
  }

  @Patch('providers/me')
  @ApiOperation({ summary: 'Update my provider profile' })
  updateProvider(@Body() dto: UpdateProviderDto, @CurrentUser() user: User) {
    return this.agentsService.updateProvider(dto, user);
  }

  @Post('providers/me/dpa')
  @ApiOperation({ summary: 'Accept the platform Data Processing Agreement' })
  acceptDpa(@Body() dto: AcceptDpaDto, @CurrentUser() user: User, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.agentsService.acceptDpa(dto, user, ip);
  }

  // ─── Agent CRUD ───────────────────────────────────────────────────────────

  @Post('providers/me/agents')
  @ApiOperation({ summary: 'Create an agent' })
  createAgent(@Body() dto: CreateAgentDto, @CurrentUser() user: User) {
    return this.agentsService.createAgent(dto, user);
  }

  @Get('providers/me/agents')
  @ApiOperation({ summary: 'List my agents' })
  listMyAgents(@CurrentUser() user: User) {
    return this.agentsService.listMyAgents(user);
  }

  @Get('providers/me/agents/:agentId')
  @ApiOperation({ summary: 'Get one of my agents' })
  getMyAgent(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.getMyAgent(agentId, user);
  }

  @Patch('providers/me/agents/:agentId')
  @ApiOperation({ summary: 'Update an agent' })
  updateAgent(
    @Param('agentId') agentId: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.updateAgent(agentId, dto, user);
  }

  @Delete('providers/me/agents/:agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent (only if not in active projects)' })
  deleteAgent(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.deleteAgent(agentId, user);
  }

  @Post('providers/me/agents/:agentId/publish')
  @ApiOperation({
    summary: 'Publish agent to Marketplace — requires KYC verification and accepted DPA',
  })
  publishAgent(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.publishAgent(agentId, user);
  }

  @Post('providers/me/agents/:agentId/unpublish')
  @ApiOperation({ summary: 'Unpublish agent from Marketplace' })
  unpublishAgent(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.unpublishAgent(agentId, user);
  }

  // ─── Personal Agents ──────────────────────────────────────────────────────

  @Post('my-agents')
  @ApiOperation({ summary: 'Create a personal agent' })
  createPersonalAgent(@Body() dto: CreatePersonalAgentDto, @CurrentUser() user: User) {
    return this.agentsService.createPersonalAgent(dto, user);
  }

  @Get('my-agents')
  @ApiOperation({ summary: 'List my personal agents' })
  listPersonalAgents(@CurrentUser() user: User) {
    return this.agentsService.listPersonalAgents(user);
  }

  @Get('my-agents/:agentId')
  @ApiOperation({ summary: 'Get a personal agent' })
  getPersonalAgent(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.getPersonalAgent(agentId, user);
  }

  @Patch('my-agents/:agentId')
  @ApiOperation({ summary: 'Update a personal agent' })
  updatePersonalAgent(
    @Param('agentId') agentId: string,
    @Body() dto: UpdatePersonalAgentDto,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.updatePersonalAgent(agentId, dto, user);
  }

  @Delete('my-agents/:agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a personal agent' })
  deletePersonalAgent(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.deletePersonalAgent(agentId, user);
  }

  // ─── Personal Agent Versions ──────────────────────────────────────────────

  @Get('my-agents/:agentId/versions')
  listPersonalAgentVersions(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.listAgentVersions(agentId, user);
  }

  @Post('my-agents/:agentId/versions')
  publishPersonalAgentVersion(
    @Param('agentId') agentId: string,
    @Body() body: { label?: string },
    @CurrentUser() user: User,
  ) {
    return this.agentsService.publishAgentVersion(agentId, user, body.label);
  }

  @Delete('my-agents/:agentId/versions/:versionId')
  @HttpCode(HttpStatus.OK)
  deletePersonalAgentVersion(
    @Param('agentId') agentId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.deleteAgentVersion(agentId, versionId, user);
  }

  @Patch('my-agents/:agentId/versions/activate')
  activatePersonalAgentVersion(
    @Param('agentId') agentId: string,
    @Body() body: { versionId: string | null },
    @CurrentUser() user: User,
  ) {
    return this.agentsService.activateAgentVersion(agentId, body.versionId, user);
  }

  // ─── Provider Agent Versions ──────────────────────────────────────────────

  @Get('providers/me/agents/:agentId/versions')
  listProviderAgentVersions(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.agentsService.listAgentVersions(agentId, user);
  }

  @Post('providers/me/agents/:agentId/versions')
  publishProviderAgentVersion(
    @Param('agentId') agentId: string,
    @Body() body: { label?: string },
    @CurrentUser() user: User,
  ) {
    return this.agentsService.publishAgentVersion(agentId, user, body.label);
  }

  @Delete('providers/me/agents/:agentId/versions/:versionId')
  @HttpCode(HttpStatus.OK)
  deleteProviderAgentVersion(
    @Param('agentId') agentId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.deleteAgentVersion(agentId, versionId, user);
  }

  @Patch('providers/me/agents/:agentId/versions/activate')
  activateProviderAgentVersion(
    @Param('agentId') agentId: string,
    @Body() body: { versionId: string | null },
    @CurrentUser() user: User,
  ) {
    return this.agentsService.activateAgentVersion(agentId, body.versionId, user);
  }

  // ─── Reviews ──────────────────────────────────────────────────────────────

  @Get('agents/:agentId/reviews')
  @ApiOperation({ summary: 'Get reviews for an agent (public)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getReviews(
    @Param('agentId') agentId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.agentsService.getReviews(agentId, page, Math.min(limit, 100));
  }

  @Post('agents/:agentId/reviews')
  @ApiOperation({ summary: 'Leave a review for an agent (workspace member who worked with them)' })
  createReview(
    @Param('agentId') agentId: string,
    @Query('projectId') projectId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.createReview(agentId, projectId, dto, user);
  }

  @Post('reviews/:reviewId/response')
  @ApiOperation({ summary: 'Provider responds to a review (one response per review)' })
  respondToReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: RespondToReviewDto,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.respondToReview(reviewId, dto, user);
  }
}
