import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    console.log('[Guard] canActivate called, token present:', !!token);
    if (!token) throw new UnauthorizedException('Missing auth token');

    let decoded: admin.auth.DecodedIdToken;
    try {
      console.log('[Guard] calling verifyIdToken...');
      decoded = await admin.auth().verifyIdToken(token);
      console.log('[Guard] verifyIdToken success, uid:', decoded.uid);
    } catch (e) {
      console.error('[Guard] verifyIdToken failed:', e);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const name = decoded.name || decoded.email?.split('@')[0] || decoded.uid;

    req.user = await this.prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? `${decoded.uid}@noreply.local`,
        name,
        avatarUrl: decoded.picture ?? null,
      },
      update: {
        ...(decoded.email && { email: decoded.email }),
        ...(name && { name }),
        ...(decoded.picture !== undefined && { avatarUrl: decoded.picture }),
      },
    });

    return true;
  }
}
