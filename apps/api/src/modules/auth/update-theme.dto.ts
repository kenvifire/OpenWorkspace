import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const VALID_THEMES = ['dark-purple', 'light', 'dark-ocean', 'midnight'] as const;
export type Theme = typeof VALID_THEMES[number];

export class UpdateThemeDto {
  @ApiProperty({ enum: VALID_THEMES })
  @IsIn(VALID_THEMES)
  theme: Theme;
}
