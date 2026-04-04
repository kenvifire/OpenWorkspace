import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { EncryptionService } from '../keys/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  generateSecret(email: string): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret(20);
    const otpauthUrl = authenticator.keyuri(email, 'OpenWorkspace', secret);
    return { secret, otpauthUrl };
  }

  verifyToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }

  async enable(user: User, secret: string, token: string): Promise<void> {
    if (!this.verifyToken(token, secret)) {
      throw new BadRequestException('Invalid verification code');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: this.encryption.encrypt(secret),
        totpEnabled: true,
      },
    });
  }

  async disable(user: User, token: string): Promise<void> {
    if (!user.totpSecret) throw new BadRequestException('2FA is not enabled');
    const secret = this.encryption.decrypt(user.totpSecret);
    if (!this.verifyToken(token, secret)) {
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnabled: false },
    });
  }

  async verify(user: User, token: string): Promise<boolean> {
    if (!user.totpEnabled || !user.totpSecret) return true; // 2FA not enabled
    const secret = this.encryption.decrypt(user.totpSecret);
    if (!this.verifyToken(token, secret)) {
      throw new UnauthorizedException('Invalid verification code');
    }
    return true;
  }
}
