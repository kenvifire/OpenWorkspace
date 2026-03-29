import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AgentsModule } from './modules/agents/agents.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { BillingModule } from './modules/billing/billing.module';
import { KeysModule } from './modules/keys/keys.module';
import { GatewayModule } from './gateway/gateway.module';
import { WorkspaceKeysModule } from './modules/workspace-keys/workspace-keys.module';
import { PlannerModule } from './modules/planner/planner.module';
import { AgentRunnerModule } from './modules/agent-runner/agent-runner.module';
import { SkillsModule } from './modules/skills/skills.module';
import { McpsModule } from './modules/mcps/mcps.module';
import { PlanningAgentModule } from './modules/planning-agent/planning-agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    AgentsModule,
    MarketplaceModule,
    TasksModule,
    BillingModule,
    KeysModule,
    GatewayModule,
    WorkspaceKeysModule,
    PlannerModule,
    AgentRunnerModule,
    SkillsModule,
    McpsModule,
    PlanningAgentModule,
  ],
})
export class AppModule {}
