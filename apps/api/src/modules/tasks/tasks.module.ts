import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { ProjectKeyGuard } from '../../common/guards/project-key.guard';
import { GatewayModule } from '../../gateway/gateway.module';
import { AgentRunnerModule } from '../agent-runner/agent-runner.module';
import { PlannerModule } from '../planner/planner.module';

@Module({
  imports: [GatewayModule, AgentRunnerModule, PlannerModule],
  providers: [TasksService, ProjectKeyGuard],
  controllers: [TasksController],
})
export class TasksModule {}
