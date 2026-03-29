import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertWorkspaceKeyDto {
  @ApiProperty({ example: 'openai', description: 'Provider: openai | anthropic | gemini | custom' })
  @IsString()
  provider: string;

  @ApiProperty({ example: 'sk-...' })
  @IsString()
  @MinLength(1)
  apiKey: string;

  @ApiPropertyOptional({ example: 'Production key' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}
