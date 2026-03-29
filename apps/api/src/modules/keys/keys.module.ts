import { Module } from '@nestjs/common';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
import { EncryptionService } from './encryption.service';
import { ProjectKeyGuard } from '../../common/guards/project-key.guard';

@Module({
  providers: [KeysService, EncryptionService, ProjectKeyGuard],
  controllers: [KeysController],
  exports: [EncryptionService],
})
export class KeysModule {}
