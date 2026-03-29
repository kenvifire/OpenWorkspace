import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectKeyGuard } from '../../common/guards/project-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { TasksService } from './tasks.service';
import { AgentRunnerService } from '../agent-runner/agent-runner.service';
import { CreateTaskDto, UpdateTaskDto, AddCommentDto } from './dto/task.dto';
import type { User, ProjectAgent } from '@prisma/client';

/**
 * Human endpoints (JWT auth) — /projects/:projectId/tasks
 * Agent endpoints (Project Key auth) — /agent/projects/:projectId/tasks
 */

@ApiTags('tasks')
@Controller()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly agentRunner: AgentRunnerService,
  ) {}

  // ─── Human (JWT) endpoints ────────────────────────────────────────────────

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/tasks')
  @ApiOperation({ summary: 'List tasks (human)' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.tasksService.findAll(projectId, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/tasks/:taskId')
  @ApiOperation({ summary: 'Get task (human)' })
  findOne(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @CurrentUser() user: User) {
    return this.tasksService.findOne(projectId, taskId, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/tasks')
  @ApiOperation({ summary: 'Create task (human)' })
  createByUser(@Param('projectId') projectId: string, @Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.create(projectId, dto, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Patch('projects/:projectId/tasks/:taskId')
  @ApiOperation({ summary: 'Update task (human)' })
  updateByUser(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.update(projectId, taskId, dto, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Delete('projects/:projectId/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete task (human)' })
  deleteTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.deleteTask(projectId, taskId, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/tasks/deleted')
  @ApiOperation({ summary: 'List soft-deleted tasks' })
  listDeleted(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.tasksService.listDeleted(projectId, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/tasks/:taskId/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted task' })
  restoreTask(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @CurrentUser() user: User) {
    return this.tasksService.restoreTask(projectId, taskId, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Delete('projects/:projectId/tasks/:taskId/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a soft-deleted task' })
  permanentlyDeleteTask(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @CurrentUser() user: User) {
    return this.tasksService.permanentlyDeleteTask(projectId, taskId, { type: 'user', entity: user });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/tasks/:taskId/comments')
  @ApiOperation({ summary: 'Add comment (human)' })
  addCommentByUser(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.addComment(projectId, taskId, dto, { type: 'user', entity: user });
  }

  // ─── Agent run log endpoints (JWT) ────────────────────────────────────────

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/tasks/:taskId/runs')
  @ApiOperation({ summary: 'List agent run logs for a task' })
  getRunLogs(@Param('taskId') taskId: string) {
    return this.agentRunner.getRunLogs(taskId);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/agents/:projectAgentId/runs')
  @ApiOperation({ summary: 'List all run logs for a project agent across all tasks' })
  getRunLogsByAgent(@Param('projectAgentId') projectAgentId: string) {
    return this.agentRunner.getRunLogsByProjectAgent(projectAgentId);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/tasks/:taskId/runs')
  @ApiOperation({ summary: 'Manually trigger agent run for a task' })
  async triggerRun(@Param('taskId') taskId: string) {
    const task = await this.tasksService.findTaskForRun(taskId);
    if (!task.assigneeId) {
      return { error: 'Task has no assignee' };
    }
    // Cancel any stale RUNNING log before enqueuing a fresh run
    await this.agentRunner.stop(taskId);
    await this.agentRunner.enqueue(taskId, task.assigneeId);
    return { queued: true };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Delete('projects/:projectId/tasks/:taskId/runs/active')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop the active agent run for a task' })
  stopRun(@Param('taskId') taskId: string) {
    return this.agentRunner.stop(taskId);
  }

  // ─── Agent (Project Key) endpoints ────────────────────────────────────────

  @ApiSecurity('project-key')
  @UseGuards(ProjectKeyGuard)
  @Get('agent/projects/:projectId/tasks')
  @ApiOperation({ summary: 'List tasks (agent)' })
  findAllByAgent(@Param('projectId') projectId: string, @CurrentAgent() agent: ProjectAgent) {
    return this.tasksService.findAll(projectId, { type: 'agent', entity: agent as any });
  }

  @ApiSecurity('project-key')
  @UseGuards(ProjectKeyGuard)
  @Get('agent/projects/:projectId/tasks/:taskId')
  @ApiOperation({ summary: 'Get task (agent)' })
  findOneByAgent(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @CurrentAgent() agent: ProjectAgent) {
    return this.tasksService.findOne(projectId, taskId, { type: 'agent', entity: agent as any });
  }

  @ApiSecurity('project-key')
  @UseGuards(ProjectKeyGuard)
  @Post('agent/projects/:projectId/tasks')
  @ApiOperation({ summary: 'Create task (agent)' })
  createByAgent(@Param('projectId') projectId: string, @Body() dto: CreateTaskDto, @CurrentAgent() agent: ProjectAgent) {
    return this.tasksService.create(projectId, dto, { type: 'agent', entity: agent as any });
  }

  @ApiSecurity('project-key')
  @UseGuards(ProjectKeyGuard)
  @Patch('agent/projects/:projectId/tasks/:taskId')
  @ApiOperation({ summary: 'Update task (agent)' })
  updateByAgent(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentAgent() agent: ProjectAgent,
  ) {
    return this.tasksService.update(projectId, taskId, dto, { type: 'agent', entity: agent as any });
  }

  @ApiSecurity('project-key')
  @UseGuards(ProjectKeyGuard)
  @Post('agent/projects/:projectId/tasks/:taskId/comments')
  @ApiOperation({ summary: 'Add comment (agent)' })
  addCommentByAgent(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AddCommentDto,
    @CurrentAgent() agent: ProjectAgent,
  ) {
    return this.tasksService.addComment(projectId, taskId, dto, { type: 'agent', entity: agent as any });
  }
}
