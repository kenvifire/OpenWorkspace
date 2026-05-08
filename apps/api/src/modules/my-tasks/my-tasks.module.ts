import { Module } from '@nestjs/common';
import { MyTasksService } from './my-tasks.service';
import { MyTasksController } from './my-tasks.controller';

@Module({
  providers: [MyTasksService],
  controllers: [MyTasksController],
})
export class MyTasksModule {}
