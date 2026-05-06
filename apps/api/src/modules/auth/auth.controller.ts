import { Controller, Get, Patch, Body, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateThemeDto } from './update-theme.dto';
import type { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the current authenticated user' })
  me(@Request() req: { user: unknown }) {
    return req.user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user theme preference' })
  async updateTheme(
    @CurrentUser() user: User,
    @Body() dto: UpdateThemeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const updated = await this.authService.updateTheme(user.id, dto.theme);
    res.cookie('theme', dto.theme, { path: '/', sameSite: 'lax', httpOnly: false });
    return updated;
  }
}
