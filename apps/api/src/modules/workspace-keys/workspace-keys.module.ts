import { Module } from '@nestjs/common';
import { WorkspaceKeysService } from './workspace-keys.service';
import { WorkspaceKeysController } from './workspace-keys.controller';
import { EncryptionService } from '../keys/encryption.service';

@Module({
  providers: [WorkspaceKeysService, EncryptionService],
  controllers: [WorkspaceKeysController],
  exports: [WorkspaceKeysService],
})
export class WorkspaceKeysModule {}
