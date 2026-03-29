import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ProjectKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest();
    const rawKey = request.headers['x-project-key'];

    if (!rawKey) {
      throw new UnauthorizedException('Missing x-project-key header');
    }

    const hashedKey = crypto
      .createHash('sha256')
      .update(rawKey as string)
      .digest('hex');

    const projectAgent = await this.prisma.projectAgent.findUnique({
      where: { projectKey: hashedKey },
      include: { project: true, agent: true },
    });

    if (!projectAgent) {
      throw new UnauthorizedException('Invalid project key');
    }

    if (projectAgent.revokedAt) {
      throw new ForbiddenException('Project key has been revoked');
    }

    // Enforce: key must have a signed agreement before use
    const agreement = await this.prisma.projectAgreement.findUnique({
      where: { projectAgentId: projectAgent.id },
    });

    if (!agreement) {
      throw new ForbiddenException(
        'Agent must accept the project agreement before accessing project data',
      );
    }

    request.projectAgent = projectAgent;
    return true;
  }
}
