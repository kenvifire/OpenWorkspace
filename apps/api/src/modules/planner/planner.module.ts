import { Module } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { PlannerController } from './planner.controller';
import { EncryptionService } from '../keys/encryption.service';
import { AgentRunnerModule } from '../agent-runner/agent-runner.module';
import { PlanningAgentModule } from '../planning-agent/planning-agent.module';

@Module({
  imports: [AgentRunnerModule, PlanningAgentModule],
  providers: [PlannerService, EncryptionService],
  controllers: [PlannerController],
  exports: [PlannerService],
})
export class PlannerModule {}
