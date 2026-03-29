import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { McpsService } from './mcps.service';
import { CreateMcpDto, UpdateMcpDto } from './dto/mcp.dto';
import type { User } from '@prisma/client';

@ApiTags('mcps')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller()
export class McpsController {
  constructor(private readonly mcpsService: McpsService) {}

  @Get('my-mcps')
  @ApiOperation({ summary: 'List my MCPs' })
  list(@CurrentUser() user: User) {
    return this.mcpsService.listMcps(user);
  }

  @Post('my-mcps')
  @ApiOperation({ summary: 'Create an MCP' })
  create(@Body() dto: CreateMcpDto, @CurrentUser() user: User) {
    return this.mcpsService.createMcp(dto, user);
  }

  @Patch('my-mcps/:mcpId')
  @ApiOperation({ summary: 'Update an MCP' })
  update(@Param('mcpId') mcpId: string, @Body() dto: UpdateMcpDto, @CurrentUser() user: User) {
    return this.mcpsService.updateMcp(mcpId, dto, user);
  }

  @Delete('my-mcps/:mcpId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an MCP' })
  delete(@Param('mcpId') mcpId: string, @CurrentUser() user: User) {
    return this.mcpsService.deleteMcp(mcpId, user);
  }

  @Get('my-agents/:agentId/mcps')
  @ApiOperation({ summary: "List an agent's MCPs" })
  listAgentMcps(@Param('agentId') agentId: string, @CurrentUser() user: User) {
    return this.mcpsService.listAgentMcps(agentId, user);
  }

  @Post('my-agents/:agentId/mcps/:mcpId')
  @ApiOperation({ summary: 'Assign an MCP to an agent' })
  assign(
    @Param('agentId') agentId: string,
    @Param('mcpId') mcpId: string,
    @CurrentUser() user: User,
  ) {
    return this.mcpsService.assignMcp(agentId, mcpId, user);
  }

  @Delete('my-agents/:agentId/mcps/:mcpId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an MCP from an agent' })
  remove(
    @Param('agentId') agentId: string,
    @Param('mcpId') mcpId: string,
    @CurrentUser() user: User,
  ) {
    return this.mcpsService.removeMcp(agentId, mcpId, user);
  }

  // ─── ProjectAgent ↔ MCP assignment ────────────────────────────────────────

  @Get('projects/:projectId/agents/:projectAgentId/mcps')
  @ApiOperation({ summary: "List MCPs assigned to a project agent" })
  listProjectAgentMcps(@Param('projectAgentId') projectAgentId: string) {
    return this.mcpsService.listProjectAgentMcps(projectAgentId);
  }

  @Post('projects/:projectId/agents/:projectAgentId/mcps/:mcpId')
  @ApiOperation({ summary: 'Assign an MCP to a project agent' })
  assignProjectAgent(
    @Param('projectAgentId') projectAgentId: string,
    @Param('mcpId') mcpId: string,
    @CurrentUser() user: User,
  ) {
    return this.mcpsService.assignProjectAgentMcp(projectAgentId, mcpId, user);
  }

  @Delete('projects/:projectId/agents/:projectAgentId/mcps/:mcpId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an MCP from a project agent' })
  removeProjectAgent(
    @Param('projectAgentId') projectAgentId: string,
    @Param('mcpId') mcpId: string,
  ) {
    return this.mcpsService.removeProjectAgentMcp(projectAgentId, mcpId);
  }
}
