import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResourceKeyDto {
  @ApiProperty({ example: 'GitHub Token' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'Read-only access to the main repo' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ description: 'The secret value to store (write-only — never returned)' })
  @IsString()
  @MinLength(1)
  value: string;
}
