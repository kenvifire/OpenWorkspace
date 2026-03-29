import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlannerService } from './planner.service';
import { SetPlannerDto, AcceptPlanDto } from './dto/planner.dto';
import type { User } from '@prisma/client';

@ApiTags('planner')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/planner')
export class PlannerController {
  constructor(private readonly service: PlannerService) {}

  @Post('set')
  @ApiOperation({ summary: 'Assign a planner agent to this project' })
  setPlanner(
    @Param('projectId') projectId: string,
    @Body() dto: SetPlannerDto,
    @CurrentUser() user: User,
  ) {
    return this.service.setPlanner(projectId, dto, user);
  }

  @Delete('set')
  @ApiOperation({ summary: 'Remove the planner agent from this project' })
  unsetPlanner(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.service.unsetPlanner(projectId, user);
  }

  @Post('run')
  @ApiOperation({ summary: 'Trigger the planner agent to generate roles and tasks (returns draft for review)' })
  runPlanner(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.service.runPlanner(projectId, user);
  }

  @Post('accept')
  @ApiOperation({ summary: 'Accept (optionally edited) planner output — commits tasks to the Kanban board' })
  acceptPlan(
    @Param('projectId') projectId: string,
    @Body() dto: AcceptPlanDto,
    @CurrentUser() user: User,
  ) {
    return this.service.acceptPlan(projectId, dto, user);
  }

  @Get('runs')
  @ApiOperation({ summary: 'List planner run logs for this project' })
  getPlannerRuns(@Param('projectId') projectId: string) {
    return this.service.getPlannerRunLogs(projectId);
  }
}
