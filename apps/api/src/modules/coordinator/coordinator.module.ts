import { Module } from '@nestjs/common';
import { CoordinatorService } from './coordinator.service';
import { CoordinatorController } from './coordinator.controller';

@Module({
  providers: [CoordinatorService],
  controllers: [CoordinatorController],
  exports: [CoordinatorService],
})
export class CoordinatorModule {}
