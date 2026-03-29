import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentRunnerService } from './agent-runner.service';

@Module({
  imports: [ConfigModule],
  providers: [AgentRunnerService],
  exports: [AgentRunnerService],
})
export class AgentRunnerModule {}
