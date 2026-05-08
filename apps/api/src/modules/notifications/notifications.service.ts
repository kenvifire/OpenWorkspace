import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KanbanGateway } from '../../gateway/kanban.gateway';
import type { NotificationData } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: KanbanGateway,
    private readonly config: ConfigService,
  ) {}

  async create(
    userId: string,
    recipientEmail: string,
    type: NotificationType,
    data: NotificationData & { taskId?: string; projectId?: string },
  ) {
    const { taskId, projectId, ...rest } = data;
    const notification = await this.prisma.notification.create({
      data: { userId, type, taskId, projectId, data: rest },
    });
    this.gateway.emitToUser(
      userId,
      'notification:created',
      notification as unknown as Record<string, unknown>,
    );
    await this.sendEmail(recipientEmail, type, data);
    return notification;
  }

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.update({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  private async sendEmail(
    to: string,
    type: NotificationType,
    data: NotificationData,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) return;

    const from =
      this.config.get<string>('RESEND_FROM_EMAIL') ??
      'noreply@openworkspace.dev';
    const subjects: Record<NotificationType, string> = {
      TASK_ASSIGNED: `You've been assigned: ${data.taskTitle}`,
      TASK_COMMENTED: `${data.actorName} commented on: ${data.taskTitle}`,
      TASK_STATUS_CHANGED: `${data.taskTitle} is now ${data.newStatus ?? 'updated'}`,
    };
    const subject = subjects[type];
    const html = this.buildEmailHtml(type, data);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Resend } = require('resend') as {
        Resend: new (key: string) => {
          emails: { send: (opts: Record<string, unknown>) => Promise<unknown> };
        };
      };
      const resend = new Resend(apiKey);
      await resend.emails.send({ from, to, subject, html });
    } catch {
      // resend not installed or email failed — non-fatal
    }
  }

  private buildEmailHtml(
    type: NotificationType,
    data: NotificationData,
  ): string {
    const projectPath = data.projectId
      ? `/projects/${data.projectId}/board`
      : '';
    const boardUrl = `${this.config.get('WEB_URL') ?? 'http://localhost:3000'}/workspaces/${data.workspaceSlug}${projectPath}`;
    const bodies: Record<NotificationType, string> = {
      TASK_ASSIGNED: `<p>${data.actorName} assigned you to <strong>${data.taskTitle}</strong> in <strong>${data.projectName}</strong>.</p>`,
      TASK_COMMENTED: `<p>${data.actorName} commented on <strong>${data.taskTitle}</strong>: "${data.commentSnippet ?? ''}"</p>`,
      TASK_STATUS_CHANGED: `<p><strong>${data.taskTitle}</strong> changed from ${data.oldStatus} to <strong>${data.newStatus}</strong>.</p>`,
    };
    return `<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#6d28d9">OpenWorkspace</h2>
      ${bodies[type]}
      <p><a href="${boardUrl}" style="color:#6d28d9">View on board →</a></p>
    </body></html>`;
  }
}
