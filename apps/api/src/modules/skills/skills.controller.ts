import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkillsService } from './skills.service';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';
import type { User } from '@prisma/client';

@ApiTags('skills')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller()
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get('my-skills')
  @ApiOperation({ summary: 'List my skills' })
  list(@CurrentUser() user: User) {
    return this.skillsService.listSkills(user);
  }

  @Post('my-skills')
  @ApiOperation({ summary: 'Create a skill' })
  create(@Body() dto: CreateSkillDto, @CurrentUser() user: User) {
    return this.skillsService.createSkill(dto, user);
  }

  @Patch('my-skills/:skillId')
  @ApiOperation({ summary: 'Update a skill' })
  update(@Param('skillId') skillId: string, @Body() dto: UpdateSkillDto, @CurrentUser() user: User) {
    return this.skillsService.updateSkill(skillId, dto, user);
  }

  @Delete('my-skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a skill' })
  delete(@Param('skillId') skillId: string, @CurrentUser() user: User) {
    return this.skillsService.deleteSkill(skillId, user);
  }

  // ─── Agent ↔ Skill assignment ─────────────────────────────────────────────

  @Get('my-agents/:agentId/skills')
  @ApiOperation({ summary: "List an agent's skills" })
  listAgentSkills(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.skillsService.listAgentSkills(agentId, user);
  }

  @Post('my-agents/:agentId/skills/:skillId')
  @ApiOperation({ summary: 'Assign a skill to an agent' })
  assign(
    @Param('agentId') agentId: string,
    @Param('skillId') skillId: string,
    @CurrentUser() user: User,
  ) {
    return this.skillsService.assignSkill(agentId, skillId, user);
  }

  @Delete('my-agents/:agentId/skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a skill from an agent' })
  remove(
    @Param('agentId') agentId: string,
    @Param('skillId') skillId: string,
    @CurrentUser() user: User,
  ) {
    return this.skillsService.removeSkill(agentId, skillId, user);
  }

  // ─── ProjectAgent ↔ Skill assignment ──────────────────────────────────────

  @Get('projects/:projectId/agents/:projectAgentId/skills')
  @ApiOperation({ summary: "List skills assigned to a project agent" })
  listProjectAgentSkills(@Param('projectAgentId') projectAgentId: string) {
    return this.skillsService.listProjectAgentSkills(projectAgentId);
  }

  @Post('projects/:projectId/agents/:projectAgentId/skills/:skillId')
  @ApiOperation({ summary: 'Assign a skill to a project agent' })
  assignProjectAgent(
    @Param('projectAgentId') projectAgentId: string,
    @Param('skillId') skillId: string,
    @CurrentUser() user: User,
  ) {
    return this.skillsService.assignProjectAgentSkill(projectAgentId, skillId, user);
  }

  @Delete('projects/:projectId/agents/:projectAgentId/skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a skill from a project agent' })
  removeProjectAgent(
    @Param('projectAgentId') projectAgentId: string,
    @Param('skillId') skillId: string,
  ) {
    return this.skillsService.removeProjectAgentSkill(projectAgentId, skillId);
  }
}
