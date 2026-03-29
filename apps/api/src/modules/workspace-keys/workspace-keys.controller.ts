import {
  Controller, Get, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkspaceKeysService } from './workspace-keys.service';
import { UpsertWorkspaceKeyDto } from './dto/workspace-key.dto';
import type { User } from '@prisma/client';

@ApiTags('workspace-keys')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/provider-keys')
export class WorkspaceKeysController {
  constructor(private readonly service: WorkspaceKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List provider keys for a workspace (values hidden)' })
  list(@Param('workspaceId') workspaceId: string, @CurrentUser() user: User) {
    return this.service.list(workspaceId, user);
  }

  @Put()
  @ApiOperation({ summary: 'Create or update a provider API key for a workspace' })
  upsert(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpsertWorkspaceKeyDto,
    @CurrentUser() user: User,
  ) {
    return this.service.upsert(workspaceId, dto, user);
  }

  @Delete(':provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a provider API key' })
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: string,
    @CurrentUser() user: User,
  ) {
    return this.service.delete(workspaceId, provider, user);
  }
}
