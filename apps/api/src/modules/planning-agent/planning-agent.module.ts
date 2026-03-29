import { Module } from '@nestjs/common';
import { PlanningAgentController, PlanningAgentsListController } from './planning-agent.controller';
import { PlanningAgentService } from './planning-agent.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KeysModule } from '../keys/keys.module';

@Module({
  imports: [PrismaModule, KeysModule],
  controllers: [PlanningAgentController, PlanningAgentsListController],
  providers: [PlanningAgentService],
  exports: [PlanningAgentService],
})
export class PlanningAgentModule {}
