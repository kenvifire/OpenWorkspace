import {
  Controller, Get, Post, Body, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorService } from './two-factor.service';
import type { User } from '@prisma/client';

class Enable2faDto {
  @IsString() secret: string;
  @IsString() @Length(6, 6) token: string;
}

class Verify2faDto {
  @IsString() @Length(6, 6) token: string;
}

@ApiTags('2fa')
@Controller('users/2fa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Get('setup')
  setup(@Request() req: { user: User }) {
    const { secret, otpauthUrl } = this.twoFactor.generateSecret(req.user.email);
    return { secret, otpauthUrl };
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  enable(@Request() req: { user: User }, @Body() dto: Enable2faDto) {
    return this.twoFactor.enable(req.user, dto.secret, dto.token);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  disable(@Request() req: { user: User }, @Body() dto: Verify2faDto) {
    return this.twoFactor.disable(req.user, dto.token);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Request() req: { user: User }, @Body() dto: Verify2faDto) {
    return this.twoFactor.verify(req.user, dto.token);
  }
}
