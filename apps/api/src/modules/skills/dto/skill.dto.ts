import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SkillType } from '@prisma/client';

export class CreateSkillDto {
  @ApiProperty({ example: 'web_search' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'Search the web for up-to-date information.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: 'When you need current information, use this skill to search the web...' })
  @IsString()
  @MaxLength(8000)
  instructions: string;

  @ApiPropertyOptional({ enum: SkillType, default: 'PROMPT' })
  @IsOptional()
  @IsEnum(SkillType)
  type?: SkillType;

  @ApiPropertyOptional({ example: 'https://api.example.com/search' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiPropertyOptional({ example: 'POST' })
  @IsOptional()
  @IsString()
  webhookMethod?: string;

  @ApiPropertyOptional({ example: '{"Authorization":"Bearer sk-..."}' })
  @IsOptional()
  @IsString()
  webhookHeaders?: string;
}

export class UpdateSkillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  instructions?: string;

  @ApiPropertyOptional({ enum: SkillType })
  @IsOptional()
  @IsEnum(SkillType)
  type?: SkillType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webhookMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webhookHeaders?: string;
}
