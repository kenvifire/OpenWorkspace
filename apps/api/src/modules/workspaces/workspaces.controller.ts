import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import type { User } from '@prisma/client';

@ApiTags('workspaces')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workspace' })
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: User) {
    return this.workspacesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces for current user' })
  findAll(@CurrentUser() user: User) {
    return this.workspacesService.findAllForUser(user.id);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get workspace by slug' })
  findOne(@Param('slug') slug: string, @CurrentUser() user: User) {
    return this.workspacesService.findOne(slug, user.id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Invite a member to workspace' })
  inviteMember(
    @Param('id') workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.workspacesService.inviteMember(workspaceId, dto, user.id);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from workspace' })
  removeMember(
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
  ) {
    return this.workspacesService.removeMember(workspaceId, memberId, user.id);
  }
}
