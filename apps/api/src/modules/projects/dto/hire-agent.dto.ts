import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';

export class HireAgentDto {
  @ApiProperty()
  @IsString()
  agentId: string;

  @ApiProperty({ enum: ProjectRole })
  @IsEnum(ProjectRole)
  role: ProjectRole;

  @ApiPropertyOptional({ description: 'Required when role is CUSTOM' })
  @IsOptional()
  @IsString()
  customRole?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCoordinator?: boolean;
}

export class AcceptAgreementDto {
  @ApiPropertyOptional({ description: 'DocuSign envelope ID — required for human agents' })
  @IsOptional()
  @IsString()
  signatureRef?: string;
}
