import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KanbanGateway } from './kanban.gateway';

@Module({
  imports: [ConfigModule],
  providers: [KanbanGateway],
  exports: [KanbanGateway],
})
export class GatewayModule {}
