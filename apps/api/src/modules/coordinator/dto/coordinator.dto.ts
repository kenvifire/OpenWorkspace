import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetCoordinatorDto {
  @ApiProperty({ description: 'ProjectAgent ID to use as coordinator' })
  @IsString()
  projectAgentId: string;
}
