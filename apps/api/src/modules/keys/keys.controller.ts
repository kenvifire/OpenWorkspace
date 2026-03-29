import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectKeyGuard } from '../../common/guards/project-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { KeysService } from './keys.service';
import { CreateResourceKeyDto } from './dto/key.dto';
import type { User, ProjectAgent } from '@prisma/client';

@ApiTags('keys')
@Controller()
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  // ─── Human (JWT) endpoints ────────────────────────────────────────────────

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/keys')
  @ApiOperation({ summary: 'Store a new resource key (leader only)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateResourceKeyDto,
    @CurrentUser() user: User,
  ) {
    return this.keysService.create(projectId, dto, user);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/keys')
  @ApiOperation({ summary: 'List resource keys for a project (names only — no values)' })
  list(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    return this.keysService.list(projectId, user);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Delete('projects/:projectId/keys/:keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resource key (leader only)' })
  delete(
    @Param('projectId') projectId: string,
    @Param('keyId') keyId: string,
    @CurrentUser() user: User,
  ) {
    return this.keysService.delete(projectId, keyId, user);
  }

  // ─── Agent (Project Key) endpoint ─────────────────────────────────────────

  @ApiSecurity('project-key')
  @UseGuards(ProjectKeyGuard)
  @Get('agent/projects/:projectId/keys/:keyId')
  @ApiOperation({
    summary: 'Retrieve a resource key value (agent only) — access is audit-logged',
  })
  getValueForAgent(
    @Param('projectId') projectId: string,
    @Param('keyId') keyId: string,
    @CurrentAgent() agent: ProjectAgent,
  ) {
    return this.keysService.getValueForAgent(projectId, keyId, agent as any);
  }
}
