import { Controller, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CoordinatorService } from './coordinator.service';
import { SetCoordinatorDto } from './dto/coordinator.dto';
import type { User } from '@prisma/client';

@ApiTags('coordinator')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/coordinator')
export class CoordinatorController {
  constructor(private readonly service: CoordinatorService) {}

  @Post('set')
  @ApiOperation({ summary: 'Assign a coordinator agent to this project' })
  setCoordinator(
    @Param('projectId') projectId: string,
    @Body() dto: SetCoordinatorDto,
    @CurrentUser() user: User,
  ) {
    return this.service.setCoordinator(projectId, dto, user);
  }

  @Delete('set')
  @ApiOperation({ summary: 'Remove the coordinator agent from this project' })
  unsetCoordinator(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.unsetCoordinator(projectId, user);
  }
}
