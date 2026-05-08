import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { KanbanGateway } from '../../gateway/kanban.gateway';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockGateway = { emitToUser: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KanbanGateway, useValue: mockGateway },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create()', () => {
    it('should write notification to DB and emit via gateway', async () => {
      const notification = {
        id: 'notif-1', userId: 'user-1', type: NotificationType.TASK_ASSIGNED,
        taskId: 'task-1', projectId: 'proj-1', read: false,
        data: { taskTitle: 'Test', projectName: 'Project', workspaceSlug: 'ws', actorName: 'Alice' },
        createdAt: new Date(),
      };
      mockPrisma.notification.create.mockResolvedValue(notification);

      await service.create('user-1', 'user@test.com', NotificationType.TASK_ASSIGNED, {
        taskTitle: 'Test', projectName: 'Project', workspaceSlug: 'ws', actorName: 'Alice',
        taskId: 'task-1', projectId: 'proj-1',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', type: NotificationType.TASK_ASSIGNED }),
        }),
      );
      expect(mockGateway.emitToUser).toHaveBeenCalledWith('user-1', 'notification:created', notification);
    });
  });

  describe('findAll()', () => {
    it('should return notifications for user, unread first then newest first', async () => {
      const notifications = [{ id: 'n1' }, { id: 'n2' }];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      const result = await service.findAll('user-1');

      expect(result).toEqual(notifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
          take: 50,
        }),
      );
    });
  });

  describe('markRead()', () => {
    it('should update notification read=true for correct user', async () => {
      mockPrisma.notification.update.mockResolvedValue({});
      await service.markRead('user-1', 'notif-1');
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { read: true },
      });
    });
  });

  describe('markAllRead()', () => {
    it('should mark all unread notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
      await service.markAllRead('user-1');
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });

  describe('sendEmail via create()', () => {
    it('should not throw when require("resend") fails', async () => {
      // Config returns an API key so the email path runs
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'RESEND_API_KEY') return 'test-key';
        return undefined;
      });
      mockPrisma.notification.create.mockResolvedValue({
        id: 'n1', userId: 'u1', type: NotificationType.TASK_ASSIGNED, read: false, data: {}, createdAt: new Date(),
      });

      // Should not throw even if resend is unavailable
      await expect(
        service.create('u1', 'x@test.com', NotificationType.TASK_ASSIGNED, {
          taskTitle: 'T', projectName: 'P', workspaceSlug: 'ws', actorName: 'A',
        }),
      ).resolves.not.toThrow();
    });
  });
});
