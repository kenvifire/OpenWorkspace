# Human Worker Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give human workers a global "My Tasks" view, real-time in-app notification bell, and email notifications for task assignments, comments, and status changes.

**Architecture:** A new `NotificationModule` (NestJS service + controller) writes notification rows to Postgres and emits real-time events to Socket.io user-scoped rooms via an extended `KanbanGateway`. `TasksService` fires notifications for human assignees after every relevant write. A new `MyTasksModule` exposes `GET /my-tasks`. On the frontend, a `NotificationBell` component and a `My Tasks` page are added to the sidebar.

**Tech Stack:** NestJS, Prisma v6, Socket.io, ioredis, Resend (`resend` npm package), React, TanStack Query, socket.io-client

---

## File Map

**Create:**
- `apps/api/src/modules/notifications/notifications.module.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/notifications/notifications.service.spec.ts`
- `apps/api/src/modules/notifications/notifications.controller.ts`
- `apps/api/src/modules/notifications/dto/notification.dto.ts`
- `apps/api/src/modules/my-tasks/my-tasks.module.ts`
- `apps/api/src/modules/my-tasks/my-tasks.service.ts`
- `apps/api/src/modules/my-tasks/my-tasks.controller.ts`
- `apps/app/hooks/use-notifications.ts`
- `apps/app/components/notification-bell.tsx`
- `apps/app/app/[locale]/(app)/my-tasks/page.tsx`

**Modify:**
- `apps/api/prisma/schema.prisma` — add `Notification` model + `NotificationType` enum + `User.notifications` relation
- `apps/api/src/gateway/kanban.gateway.ts` — add `join:user` handler + `emitToUser()` method
- `apps/api/src/modules/tasks/tasks.service.ts` — inject `NotificationService`, fire on create/update/addComment
- `apps/api/src/modules/tasks/tasks.service.spec.ts` — add `mockNotificationService`
- `apps/api/src/modules/tasks/tasks.module.ts` — import `NotificationModule`
- `apps/api/src/app.module.ts` — import `NotificationModule` + `MyTasksModule`
- `packages/api-types/src/models.ts` — add `Notification` + `NotificationType`
- `apps/app/lib/api.ts` — add `notificationsApi` + `myTasksApi`
- `apps/app/components/sidebar.tsx` — add My Tasks nav item + `NotificationBell`

---

## Task 1: Prisma — Notification model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the Notification model and enum to schema.prisma**

Open `apps/api/prisma/schema.prisma`. Find the User model (around line 12). Add `notifications Notification[]` to its relations block, after `reviews AgentReview[]`:

```prisma
  reviews              AgentReview[]
  notifications        Notification[]
```

Then append these two blocks at the very end of the file (after the last model):

```prisma
// ─── Notifications ────────────────────────────────────────────────────────────

model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  type      NotificationType
  taskId    String?
  projectId String?
  read      Boolean          @default(false)
  data      Json
  createdAt DateTime         @default(now())

  @@index([userId, createdAt])
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_COMMENTED
  TASK_STATUS_CHANGED
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_notifications
```

Expected: `The following migration(s) have been applied: 20260508xxxxxx_add_notifications`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd apps/api && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add Notification model to Prisma schema"
```

---

## Task 2: KanbanGateway — user rooms + emitToUser

**Files:**
- Modify: `apps/api/src/gateway/kanban.gateway.ts`

- [ ] **Step 1: Write a failing test for emitToUser**

In `apps/api/src/gateway/kanban.gateway.ts`, before writing code, add the test inline. Actually since the gateway uses `@WebSocketServer()`, its unit test is complex. We'll verify manually after implementation. Skip to Step 2.

- [ ] **Step 2: Add join:user SubscribeMessage handler and emitToUser method**

Open `apps/api/src/gateway/kanban.gateway.ts`. Make the following changes:

1. Update the `KanbanEvent` type to include `notification:created`:

```ts
export type KanbanEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'comment:created'
  | 'notification:created';
```

2. Add a new exported interface for user-scoped payloads (after `KanbanPayload`):

```ts
export interface UserPayload {
  userId: string;
  data: Record<string, unknown>;
}
```

3. Add the `join:user` handler and `emitToUser` method after the existing `handleLeaveProject` method:

```ts
  @SubscribeMessage('join:user')
  handleJoinUser(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    client.join(`user:${userId}`);
    return { event: 'joined:user', data: userId };
  }

  /** Emit to a specific user's personal room */
  emitToUser(userId: string, event: KanbanEvent, data: Record<string, unknown>) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
```

- [ ] **Step 3: Verify build**

```bash
cd apps/api && pnpm run build 2>&1 | tail -5
```

Expected: `Successfully compiled` (no TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/gateway/kanban.gateway.ts
git commit -m "feat: add user-scoped rooms and emitToUser to KanbanGateway"
```

---

## Task 3: NotificationService — DB write + gateway emit

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.service.ts`
- Create: `apps/api/src/modules/notifications/notifications.service.spec.ts`
- Create: `apps/api/src/modules/notifications/dto/notification.dto.ts`
- Create: `apps/api/src/modules/notifications/notifications.module.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/modules/notifications/notifications.service.spec.ts`:

```ts
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
    it('should return notifications for user ordered by createdAt desc', async () => {
      const notifications = [{ id: 'n1' }, { id: 'n2' }];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      const result = await service.findAll('user-1');

      expect(result).toEqual(notifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest notifications.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: `FAIL` with "Cannot find module './notifications.service'"

- [ ] **Step 3: Create the DTO file**

Create `apps/api/src/modules/notifications/dto/notification.dto.ts`:

```ts
import { IsString, IsOptional } from 'class-validator';
import { NotificationType } from '@prisma/client';

export interface NotificationData {
  taskTitle: string;
  projectName: string;
  workspaceSlug: string;
  actorName: string;
  taskId?: string;
  projectId?: string;
  oldStatus?: string;
  newStatus?: string;
  commentSnippet?: string;
}

export class MarkReadDto {
  @IsString()
  @IsOptional()
  id?: string;
}
```

- [ ] **Step 4: Create NotificationsService**

Create `apps/api/src/modules/notifications/notifications.service.ts`:

```ts
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
    this.gateway.emitToUser(userId, 'notification:created', notification as unknown as Record<string, unknown>);
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

  private async sendEmail(to: string, type: NotificationType, data: NotificationData) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) return;

    const from = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'noreply@openworkspace.dev';
    const subjects: Record<NotificationType, string> = {
      TASK_ASSIGNED: `You've been assigned: ${data.taskTitle}`,
      TASK_COMMENTED: `${data.actorName} commented on: ${data.taskTitle}`,
      TASK_STATUS_CHANGED: `${data.taskTitle} is now ${data.newStatus}`,
    };
    const subject = subjects[type];
    const html = this.buildEmailHtml(type, data);

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);
      await resend.emails.send({ from, to, subject, html });
    } catch {
      // Email failures are non-fatal
    }
  }

  private buildEmailHtml(type: NotificationType, data: NotificationData): string {
    const boardUrl = `${this.config.get('WEB_URL') ?? 'http://localhost:3000'}/en/workspaces/${data.workspaceSlug}`;
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && npx jest notifications.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: `PASS apps/api/src/modules/notifications/notifications.service.spec.ts` with 4 passing tests

- [ ] **Step 6: Create notifications.module.ts**

Create `apps/api/src/modules/notifications/notifications.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { GatewayModule } from '../../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/notifications/
git commit -m "feat: add NotificationsService with DB write and gateway emit"
```

---

## Task 4: NotificationsController

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.controller.ts`

- [ ] **Step 1: Create notifications.controller.ts**

Create `apps/api/src/modules/notifications/notifications.controller.ts`:

```ts
import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import type { User } from '@prisma/client';

@ApiTags('notifications')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.markRead(user.id, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.service.markAllRead(user.id);
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/api && pnpm run build 2>&1 | tail -5
```

Expected: `Successfully compiled`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.controller.ts
git commit -m "feat: add NotificationsController (list, mark-read, mark-all-read)"
```

---

## Task 5: TasksService — notification triggers

**Files:**
- Modify: `apps/api/src/modules/tasks/tasks.service.ts`
- Modify: `apps/api/src/modules/tasks/tasks.service.spec.ts`
- Modify: `apps/api/src/modules/tasks/tasks.module.ts`

- [ ] **Step 1: Update tasks.service.spec.ts to add mockNotificationService**

Open `apps/api/src/modules/tasks/tasks.service.spec.ts`. Add import at the top:

```ts
import { NotificationsService } from '../notifications/notifications.service';
```

Add the mock after `mockCoordinatorService`:

```ts
const mockNotificationService = {
  create: jest.fn(),
};
```

In the `beforeEach` `providers` array, add:

```ts
{ provide: NotificationsService, useValue: mockNotificationService },
```

Add a new test in the `create()` describe block:

```ts
it('should call notificationService.create when assignee is a HUMAN agent', async () => {
  const task = makeTask({ assigneeId: 'pa-1' });
  mockPrisma.task.create.mockResolvedValue(task);
  mockPrisma.projectAgent.findUnique.mockResolvedValue({
    id: 'pa-1',
    agentId: 'agent-1',
    projectId,
    agent: {
      type: 'HUMAN',
      userId: 'user-1',
      owner: { id: 'user-1', email: 'worker@test.com', name: 'Worker' },
    },
    project: { name: 'Test Project', workspace: { slug: 'test-ws' } },
  });
  mockNotificationService.create.mockResolvedValue(undefined);

  const dto = { title: 'Human Task', assigneeId: 'pa-1' };
  await service.create(projectId, dto, userActor);

  expect(mockNotificationService.create).toHaveBeenCalledWith(
    'user-1',
    'worker@test.com',
    'TASK_ASSIGNED',
    expect.objectContaining({ taskTitle: 'Test Task', projectName: 'Test Project' }),
  );
});
```

- [ ] **Step 2: Run the spec to confirm the new test fails**

```bash
cd apps/api && npx jest tasks.service.spec.ts --no-coverage 2>&1 | tail -15
```

Expected: previous tests PASS, new `should call notificationService.create when assignee is a HUMAN agent` test FAILS.

- [ ] **Step 3: Update tasks.service.ts — inject NotificationsService**

Open `apps/api/src/modules/tasks/tasks.service.ts`. Update the imports and constructor:

```ts
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
```

Add to the constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly gateway: KanbanGateway,
  private readonly agentRunner: AgentRunnerService,
  private readonly plannerService: PlannerService,
  private readonly coordinator: CoordinatorService,
  private readonly notifications: NotificationsService,
) {}
```

- [ ] **Step 4: Add maybeNotifyHumanAssignee private method**

Add this private method at the end of the class (before the closing `}`):

```ts
private async maybeNotifyHumanAssignee(
  taskId: string,
  type: NotificationType,
  actorName: string,
  extraData?: { oldStatus?: string; newStatus?: string; commentSnippet?: string },
) {
  // Get task to find assigneeId
  const task = await this.prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, assigneeId: true },
  });
  if (!task?.assigneeId) return;

  const pa = await this.prisma.projectAgent.findUnique({
    where: { id: task.assigneeId },
    include: {
      agent: {
        select: {
          type: true,
          userId: true,
          owner: { select: { id: true, email: true, name: true } },
        },
      },
      project: {
        select: { name: true, workspace: { select: { slug: true } } },
      },
    },
  });

  if (pa?.agent.type !== 'HUMAN' || !pa.agent.userId || !pa.agent.owner) return;

  await this.notifications.create(
    pa.agent.userId,
    pa.agent.owner.email,
    type,
    {
      taskTitle: task.title,
      projectName: pa.project.name,
      workspaceSlug: pa.project.workspace.slug,
      actorName,
      taskId: task.id,
      projectId: pa.projectId,
      ...extraData,
    },
  );
}
```

- [ ] **Step 5: Add notification call in create()**

In `tasks.service.ts`, in the `create()` method, after `this.gateway.emit('task:created', ...)` and before the agent enqueue logic, add:

```ts
    // Notify human assignee if applicable
    if (dto.assigneeId) {
      const actorName = actor.type === 'user' ? actor.entity.name : 'An agent';
      await this.maybeNotifyHumanAssignee(task.id, NotificationType.TASK_ASSIGNED, actorName).catch(() => {});
    }
```

- [ ] **Step 6: Add notification call in update()**

In `tasks.service.ts`, in the `update()` method, after the `this.gateway.emit('task:updated', ...)` call, add:

```ts
    // Notify human assignee on status change
    if (dto.status && dto.status !== prevStatus) {
      const actorName = actor.type === 'user' ? actor.entity.name : 'An agent';
      await this.maybeNotifyHumanAssignee(
        taskId,
        NotificationType.TASK_STATUS_CHANGED,
        actorName,
        { oldStatus: prevStatus, newStatus: dto.status },
      ).catch(() => {});
    }
```

- [ ] **Step 7: Add notification call in addComment()**

In `tasks.service.ts`, in the `addComment()` method, after `this.gateway.emit('comment:created', ...)`, add:

```ts
    // Notify human assignee when someone else comments
    if (actor.type === 'user' && task.assigneeId) {
      const snippet = dto.content.slice(0, 120);
      await this.maybeNotifyHumanAssignee(
        taskId,
        NotificationType.TASK_COMMENTED,
        actor.entity.name,
        { commentSnippet: snippet },
      ).catch(() => {});
    }
```

- [ ] **Step 8: Run all specs to verify they pass**

```bash
cd apps/api && npx jest tasks.service.spec.ts --no-coverage 2>&1 | tail -15
```

Expected: `PASS` with all tests including the new human notification test.

- [ ] **Step 9: Update tasks.module.ts to import NotificationsModule**

Open `apps/api/src/modules/tasks/tasks.module.ts`. Add the import:

```ts
import { NotificationsModule } from '../notifications/notifications.module';
```

Update the `imports` array:

```ts
@Module({
  imports: [GatewayModule, AgentRunnerModule, PlannerModule, CoordinatorModule, NotificationsModule],
  providers: [TasksService, ProjectKeyGuard],
  controllers: [TasksController],
})
export class TasksModule {}
```

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/tasks/ apps/api/src/modules/notifications/notifications.module.ts
git commit -m "feat: fire human-worker notifications from TasksService on assign, status change, and comment"
```

---

## Task 6: MyTasksModule + MyTasksController

**Files:**
- Create: `apps/api/src/modules/my-tasks/my-tasks.service.ts`
- Create: `apps/api/src/modules/my-tasks/my-tasks.controller.ts`
- Create: `apps/api/src/modules/my-tasks/my-tasks.module.ts`

- [ ] **Step 1: Create my-tasks.service.ts**

Create `apps/api/src/modules/my-tasks/my-tasks.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MyTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(userId: string) {
    // Resolve: User → Agent (userId) → ProjectAgent (agentId) → Task (assigneeId)
    const agents = await this.prisma.agent.findMany({
      where: { userId },
      select: { id: true, projectAgents: { select: { id: true } } },
    });

    const projectAgentIds = agents.flatMap((a) => a.projectAgents.map((pa) => pa.id));
    if (projectAgentIds.length === 0) return [];

    return this.prisma.task.findMany({
      where: { assigneeId: { in: projectAgentIds }, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            workspace: { select: { slug: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
```

- [ ] **Step 2: Create my-tasks.controller.ts**

Create `apps/api/src/modules/my-tasks/my-tasks.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MyTasksService } from './my-tasks.service';
import type { User } from '@prisma/client';

@ApiTags('my-tasks')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('my-tasks')
export class MyTasksController {
  constructor(private readonly service: MyTasksService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.service.findForUser(user.id);
  }
}
```

- [ ] **Step 3: Create my-tasks.module.ts**

Create `apps/api/src/modules/my-tasks/my-tasks.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MyTasksService } from './my-tasks.service';
import { MyTasksController } from './my-tasks.controller';

@Module({
  providers: [MyTasksService],
  controllers: [MyTasksController],
})
export class MyTasksModule {}
```

- [ ] **Step 4: Register both modules in AppModule**

Open `apps/api/src/app.module.ts`. Add imports:

```ts
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MyTasksModule } from './modules/my-tasks/my-tasks.module';
```

Add to the `imports` array (after `CoordinatorModule`):

```ts
    NotificationsModule,
    MyTasksModule,
```

- [ ] **Step 5: Verify build**

```bash
cd apps/api && pnpm run build 2>&1 | tail -5
```

Expected: `Successfully compiled`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/my-tasks/ apps/api/src/app.module.ts
git commit -m "feat: add MyTasksModule with GET /my-tasks endpoint"
```

---

## Task 7: Email via Resend

**Files:**
- Modify: `apps/api/src/modules/notifications/notifications.service.ts` (already has sendEmail — just install the package)

- [ ] **Step 1: Install resend package**

```bash
cd apps/api && pnpm add resend
```

Expected: `dependencies: + resend x.x.x`

- [ ] **Step 2: Verify the dynamic import in sendEmail still works**

The `sendEmail` method in `notifications.service.ts` already uses `const { Resend } = await import('resend')`. Verify it compiles:

```bash
cd apps/api && pnpm run build 2>&1 | tail -5
```

Expected: `Successfully compiled`

- [ ] **Step 3: Add env var documentation**

Open `.env.example` in the repo root (or `apps/api/.env.example` if it exists). Add:

```bash
# Resend email notifications (optional — skipped if absent)
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@openworkspace.dev
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "feat: install resend for email notifications"
```

---

## Task 8: api-types — Notification interface

**Files:**
- Modify: `packages/api-types/src/models.ts`

- [ ] **Step 1: Add Notification interfaces to models.ts**

Open `packages/api-types/src/models.ts`. Append at the end of the file:

```ts
// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = 'TASK_ASSIGNED' | 'TASK_COMMENTED' | 'TASK_STATUS_CHANGED'

export interface NotificationData {
  taskTitle: string
  projectName: string
  workspaceSlug: string
  actorName: string
  oldStatus?: string
  newStatus?: string
  commentSnippet?: string
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  taskId: string | null
  projectId: string | null
  read: boolean
  data: NotificationData
  createdAt: string
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api-types/src/models.ts
git commit -m "feat: add Notification types to api-types"
```

---

## Task 9: api.ts — client methods

**Files:**
- Modify: `apps/app/lib/api.ts`

- [ ] **Step 1: Add imports and API clients**

Open `apps/app/lib/api.ts`. Add `Notification` to the import from `@openworkspace/api-types`:

```ts
import type {
  // ... existing imports ...
  Notification,
} from '@openworkspace/api-types';
```

Append at the end of the file:

```ts
// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (): Promise<Notification[]> =>
    api.get('/api/notifications').then((r) => r.data),
  markRead: (id: string): Promise<void> =>
    api.patch(`/api/notifications/${id}/read`).then((r) => r.data),
  markAllRead: (): Promise<void> =>
    api.patch('/api/notifications/read-all').then((r) => r.data),
};

// ─── My Tasks ─────────────────────────────────────────────────────────────────
export const myTasksApi = {
  list: (): Promise<Array<Task & { project: { id: string; name: string; workspace: { slug: string } } }>> =>
    api.get('/api/my-tasks').then((r) => r.data),
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/lib/api.ts
git commit -m "feat: add notificationsApi and myTasksApi clients"
```

---

## Task 10: useNotifications hook

**Files:**
- Create: `apps/app/hooks/use-notifications.ts`

- [ ] **Step 1: Create the hook**

Create `apps/app/hooks/use-notifications.ts`:

```ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { auth } from '@/lib/firebase';
import { notificationsApi } from '@/lib/api';
import type { Notification } from '@openworkspace/api-types';

let socket: Socket | null = null;

function getSocket(token?: string | null): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/kanban`, {
      withCredentials: true,
      auth: token ? { token } : undefined,
    });
  }
  return socket;
}

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();
  const joinedRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  useEffect(() => {
    if (!userId) return;
    let cleanup: (() => void) | undefined;

    (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)).then((token) => {
      const s = getSocket(token);

      if (!joinedRef.current) {
        s.emit('join:user', userId);
        joinedRef.current = true;
      }

      const onNotification = () => {
        setUnreadCount((c) => c + 1);
        refreshUnread();
      };

      s.on('notification:created', onNotification);

      cleanup = () => {
        s.off('notification:created', onNotification);
        joinedRef.current = false;
      };
    });

    return () => cleanup?.();
  }, [userId, refreshUnread]);

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setUnreadCount((c) => Math.max(0, c - 1));
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  return { unreadCount, setUnreadCount, markRead, markAllRead };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/hooks/use-notifications.ts
git commit -m "feat: add useNotifications hook with Socket.io user room subscription"
```

---

## Task 11: NotificationBell component

**Files:**
- Create: `apps/app/components/notification-bell.tsx`

- [ ] **Step 1: Create the component**

Create `apps/app/components/notification-bell.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { notificationsApi } from '@/lib/api';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import type { Notification } from '@openworkspace/api-types';

function timeAgo(date: string): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function notifIcon(type: Notification['type']) {
  if (type === 'TASK_ASSIGNED') return '📋';
  if (type === 'TASK_COMMENTED') return '💬';
  return '🔄';
}

function notifTitle(n: Notification): string {
  if (n.type === 'TASK_ASSIGNED') return `Assigned: ${n.data.taskTitle}`;
  if (n.type === 'TASK_COMMENTED') return `${n.data.actorName} commented on: ${n.data.taskTitle}`;
  return `${n.data.taskTitle} → ${n.data.newStatus}`;
}

interface Props {
  userId: string | undefined;
}

export function NotificationBell({ userId }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { unreadCount, setUnreadCount, markRead, markAllRead } = useNotifications(userId);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: !!userId,
    onSuccess: (data) => {
      setUnreadCount(data.filter((n) => !n.read).length);
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    if (n.projectId) {
      router.push(`/${locale}/workspaces/${n.data.workspaceSlug}/projects/${n.projectId}/board`);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-workspace)] text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--accent-workspace)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 10).length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No notifications yet</p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-[var(--border-subtle)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-overlay)]',
                    !n.read && 'bg-[var(--accent-workspace-bg)]',
                  )}
                >
                  <span className="mt-0.5 text-sm">{notifIcon(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm', !n.read ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                      {notifTitle(n)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {n.data.projectName} · {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-workspace)]" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/components/notification-bell.tsx
git commit -m "feat: add NotificationBell component with real-time updates"
```

---

## Task 12: My Tasks page

**Files:**
- Create: `apps/app/app/[locale]/(app)/my-tasks/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/app/app/[locale]/(app)/my-tasks/page.tsx`:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { myTasksApi, tasksApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { cn } from '@/lib/utils';
import type { Task } from '@openworkspace/api-types';
import { TaskDetail } from '@/components/kanban/task-detail';
import { Loader2, CheckSquare } from 'lucide-react';

type MyTask = Task & { project: { id: string; name: string; workspace: { slug: string } } };

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
  TODO: 'bg-blue-500/10 text-blue-400',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-400',
  BLOCKED: 'bg-red-500/10 text-red-400',
  DONE: 'bg-emerald-500/10 text-emerald-400',
};

const PRIORITY_DOTS: Record<string, string> = {
  LOW: 'bg-[var(--text-muted)]',
  MEDIUM: 'bg-amber-400',
  HIGH: 'bg-red-400',
  URGENT: 'bg-red-600',
};

export default function MyTasksPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<{ taskId: string; projectId: string } | null>(null);

  const { data: tasks = [], isLoading } = useQuery<MyTask[]>({
    queryKey: ['my-tasks'],
    queryFn: myTasksApi.list,
    enabled: !!user,
  });

  // Group by project
  const grouped = tasks.reduce<Record<string, { projectName: string; slug: string; tasks: MyTask[] }>>(
    (acc, task) => {
      const key = task.project.id;
      if (!acc[key]) {
        acc[key] = { projectName: task.project.name, slug: task.project.workspace.slug, tasks: [] };
      }
      acc[key].tasks.push(task);
      return acc;
    },
    {},
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <CheckSquare size={22} className="text-[var(--accent-workspace)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-syne)' }}>
          My Tasks
        </h1>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16 text-center">
          <CheckSquare size={32} className="text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([projectId, group]) => (
            <div key={projectId}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                {group.projectName}
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {group.tasks.map((task, i) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask({ taskId: task.id, projectId: task.project.id })}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)]',
                      i > 0 && 'border-t border-[var(--border-subtle)]',
                    )}
                  >
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOTS[task.priority] ?? 'bg-[var(--text-muted)]')}
                    />
                    <span className="flex-1 truncate text-sm text-[var(--text-primary)]">{task.title}</span>
                    <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', STATUS_COLORS[task.status])}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetail
          taskId={selectedTask.taskId}
          projectId={selectedTask.projectId}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
```


- [ ] **Step 2: Commit**

```bash
git add apps/app/app/[locale]/(app)/my-tasks/
git commit -m "feat: add My Tasks page grouped by project"
```

---

## Task 13: Sidebar — My Tasks nav item + NotificationBell

**Files:**
- Modify: `apps/app/components/sidebar.tsx`

- [ ] **Step 1: Add My Tasks to navItems and NotificationBell to the header**

Open `apps/app/components/sidebar.tsx`. 

1. Add `CheckSquare` to the lucide-react import:

```ts
import {
  LayoutDashboard, Store, CreditCard, Settings, Plus,
  LogOut, Bot, Zap, Server, Brain, CheckSquare,
} from 'lucide-react';
```

2. Import `NotificationBell`:

```ts
import { NotificationBell } from '@/components/notification-bell';
```

3. Add My Tasks to the `navItems` array:

```ts
  const navItems = [
    { label: t('dashboard'), href: `/${locale}/dashboard`, icon: LayoutDashboard },
    { label: 'My Tasks', href: `/${locale}/my-tasks`, icon: CheckSquare },
    { label: t('marketplace'), href: `/${locale}/marketplace`, icon: Store },
    { label: t('billing'), href: `/${locale}/billing`, icon: CreditCard },
  ];
```

4. Add `NotificationBell` to the brand bar (the `<div>` with class `flex items-center gap-2.5 border-b ...`). Replace the closing `</div>` of that block with:

```tsx
        <div className="ml-auto">
          <NotificationBell userId={user?.uid} />
        </div>
      </div>
```

- [ ] **Step 2: Verify the app builds**

```bash
cd apps/app && pnpm run build 2>&1 | tail -10
```

Expected: Build completes without TypeScript errors. (Ignore any `TaskDetail` errors if the component doesn't exist yet — fix per the note in Task 12.)

- [ ] **Step 3: Start dev and verify visually**

```bash
pnpm dev
```

Open http://localhost:3000. Verify:
- "My Tasks" link appears in the sidebar nav
- Notification bell icon appears in the sidebar header
- Clicking "My Tasks" navigates to `/en/my-tasks`
- Empty state renders: "No tasks assigned to you yet."

- [ ] **Step 4: Commit**

```bash
git add apps/app/components/sidebar.tsx
git commit -m "feat: add My Tasks nav link and NotificationBell to sidebar"
```

---

## Self-Review Checklist

After all tasks are complete, verify:

- [ ] `npx prisma migrate status` shows no pending migrations
- [ ] `cd apps/api && npx jest --no-coverage` — all tests pass
- [ ] `cd apps/api && pnpm run build` — compiles clean
- [ ] `cd apps/app && pnpm run build` — compiles clean
- [ ] Assigning a task to a human worker triggers notification row in DB + Socket.io event
- [ ] `RESEND_API_KEY` absent → no error, email silently skipped
- [ ] Notification bell shows unread count badge
- [ ] Mark all read clears the badge
- [ ] My Tasks page groups tasks by project and opens TaskDetail on click
