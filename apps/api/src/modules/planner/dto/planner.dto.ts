import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SetPlannerDto {
  @ApiProperty({ description: 'ProjectAgent ID to use as planner' })
  @IsString()
  projectAgentId: string;
}

export class PlannerRoleDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class PlannerTaskDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  role: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ProjectAgent ID to assign this task to' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Titles of tasks that must complete before this one', type: [String] })
  @IsOptional()
  @IsArray()
  dependencies?: string[];
}

export class AcceptPlanDto {
  @ApiProperty({ type: [PlannerRoleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannerRoleDto)
  roles: PlannerRoleDto[];

  @ApiProperty({ type: [PlannerTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannerTaskDto)
  tasks: PlannerTaskDto[];

  @ApiPropertyOptional({ description: 'If true, delete all BACKLOG tasks before creating new ones' })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
