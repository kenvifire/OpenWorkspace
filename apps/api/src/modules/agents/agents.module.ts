import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { EncryptionService } from '../keys/encryption.service';

@Module({
  providers: [AgentsService, EncryptionService],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
