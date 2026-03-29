import {
  Controller, Get, Patch, Post, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlanningAgentService } from './planning-agent.service';
import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import type { User } from '@prisma/client';

@ApiTags('planning-agent')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('planning-agents')
export class PlanningAgentsListController {
  constructor(private readonly service: PlanningAgentService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get user-level planning agent configuration' })
  getConfig(@CurrentUser() user: User) {
    return this.service.getConfig(user);
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update user-level planning agent configuration' })
  updateConfig(
    @Body() body: { userDefaultPrompt?: string; provider?: string | null; model?: string | null; apiKey?: string | null },
    @CurrentUser() user: User,
  ) {
    return this.service.updateConfig(body, user);
  }
}

class UpdateCustomPromptDto {
  @IsString()
  @MaxLength(8000)
  customPrompt: string;
}

class PublishVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

class ActivateVersionDto {
  @IsOptional()
  @IsString()
  versionId: string | null;
}

@ApiTags('planning-agent')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/planning-agent')
export class PlanningAgentController {
  constructor(private readonly service: PlanningAgentService) {}

  @Get()
  @ApiOperation({ summary: 'Get the project planning agent' })
  get(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.service.getOrCreate(projectId, user);
  }

  @Patch('prompt')
  @ApiOperation({ summary: 'Update custom prompt' })
  updatePrompt(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateCustomPromptDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateCustomPrompt(projectId, dto.customPrompt, user);
  }

  @Post('versions')
  @ApiOperation({ summary: 'Publish a new version (max 3)' })
  publishVersion(
    @Param('projectId') projectId: string,
    @Body() dto: PublishVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.publishVersion(projectId, dto.label, user);
  }

  @Delete('versions/:versionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a version' })
  deleteVersion(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.deleteVersion(projectId, versionId, user);
  }

  @Patch('activate')
  @ApiOperation({ summary: 'Activate a version (or null to use draft)' })
  activateVersion(
    @Param('projectId') projectId: string,
    @Body() dto: ActivateVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.activateVersion(projectId, dto.versionId, user);
  }
}
