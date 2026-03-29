import {
  IsString, IsEnum, IsOptional, IsArray, IsInt, IsNumber, Min, Max, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentType, PricingModel } from '@prisma/client';

export class CreateAgentDto {
  @ApiProperty({ example: 'CodeBot Pro' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @ApiProperty({ enum: AgentType })
  @IsEnum(AgentType)
  type: AgentType;

  @ApiProperty({ enum: PricingModel })
  @IsEnum(PricingModel)
  pricingModel: PricingModel;

  @ApiPropertyOptional({ description: 'Fixed price in cents — required for PER_JOB', example: 5000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerJob?: number;

  @ApiPropertyOptional({ description: 'Price per token in micro-cents — required for PER_TOKEN', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerToken?: number;

  @ApiProperty({ example: ['coding', 'typescript', 'testing'] })
  @IsArray()
  @IsString({ each: true })
  capabilityTags: string[];

  // ─── LLM Config (AI agents) ───────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'openai', description: 'openai | anthropic | gemini | custom' })
  @IsOptional()
  @IsString()
  llmProvider?: string;

  @ApiPropertyOptional({ example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  modelName?: string;

  @ApiPropertyOptional({ example: 'You are a backend developer...' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Raw API key — stored encrypted; overrides workspace key', example: 'sk-...' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2, example: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 4096 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;

  @ApiPropertyOptional({ example: 20, description: 'Max agentic loop iterations (default 20)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxIterations?: number;

  @ApiPropertyOptional({ example: ['get_task', 'add_comment', 'complete_task'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTools?: string[];
}

export class UpdateAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerJob?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerToken?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilityTags?: string[];

  // ─── LLM Config ───────────────────────────────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  llmProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Raw API key — stored encrypted' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxIterations?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTools?: string[];
}

export class RespondToReviewDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  response: string;
}

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
