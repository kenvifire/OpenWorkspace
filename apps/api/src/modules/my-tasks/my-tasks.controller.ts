import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MyTasksService } from './my-tasks.service';
import type { User } from '@prisma/client';

@ApiTags('my-tasks')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('my-tasks')
export class MyTasksController {
  constructor(private readonly service: MyTasksService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.service.findForUser(user.id);
  }
}
