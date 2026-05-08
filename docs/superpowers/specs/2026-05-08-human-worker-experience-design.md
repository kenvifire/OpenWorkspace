# Human Worker Experience Design

## Overview

Human workers assigned to tasks on the platform currently have no dedicated view of their work and receive no notifications when assigned or when their tasks change. This spec covers the end-to-end human worker experience: a global "My Tasks" page, a real-time in-app notification bell, and email notifications — all built on the existing Socket.io + Redis infrastructure.

## Goals

- Human workers can see all tasks assigned to them across all projects in one place
- Workers are notified in real-time (in-app) and by email when assigned, commented on, or when their task status changes
- Workers have full status control over their tasks (TODO → IN_PROGRESS → DONE and back)
- No new real-time infrastructure required — extends the existing KanbanGateway

## Non-Goals

- Notification preferences/settings (all notification types are always on)
- Push notifications (browser push or mobile)
- Digest emails (one email per event, not batched)
- Worker-specific task claiming or acceptance flow (tasks are assigned by the project leader)

---

## Data Model

One new Prisma model added to `apps/api/prisma/schema.prisma`:

```prisma
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
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_COMMENTED
  TASK_STATUS_CHANGED
}
```

The `data` JSON field carries all context needed to render a notification without additional DB queries:

```ts
{
  taskTitle: string
  projectName: string
  workspaceSlug: string
  actorName: string        // who triggered the event
  oldStatus?: TaskStatus   // TASK_STATUS_CHANGED only
  newStatus?: TaskStatus   // TASK_STATUS_CHANGED only
  commentSnippet?: string  // TASK_COMMENTED only (first 120 chars)
}
```

`taskId` and `projectId` are stored as plain strings (not enforced FK relations) to avoid cascade issues when tasks are soft-deleted.

The `User` model gets the inverse relation: `notifications Notification[]`.

---

## Backend

### NotificationModule

New module at `apps/api/src/modules/notifications/`.

**`NotificationService`**

```ts
create(userId: string, type: NotificationType, data: NotificationData): Promise<Notification>
findAll(userId: string): Promise<Notification[]>   // last 50, unread first
markRead(userId: string, id: string): Promise<void>
markAllRead(userId: string): Promise<void>
```

`create()` does three things atomically from the caller's perspective:
1. Writes the `Notification` row to DB
2. Emits `notification:created` to the Socket.io room `user:{userId}` via `KanbanGateway`
3. Sends an email via Resend if `RESEND_API_KEY` is set (silently skips if absent)

**`NotificationController`** — all routes JWT-gated:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List notifications for current user |
| PATCH | `/notifications/:id/read` | Mark one notification read |
| PATCH | `/notifications/read-all` | Mark all notifications read |

### KanbanGateway changes

On `handleConnection`, after the client authenticates, join the personal room:

```ts
socket.join(`user:${userId}`);
```

The gateway already manages project rooms (`project:{projectId}`); this is additive. A new `emitToUser(userId, event, data)` method is added to `KanbanGateway` alongside the existing `emit()` — it calls `this.server.to('user:${userId}').emit(event, data)`. `NotificationService` calls this new method.

### TasksService integration

`NotificationService` is injected into `TasksService`. Three trigger points:

**1. `create()` — task assigned on creation**
If `dto.assigneeId` is set and the assignee is a human agent (`agent.type === 'HUMAN'`), call:
```ts
notificationService.create(agent.userId, NotificationType.TASK_ASSIGNED, { taskTitle, projectName, workspaceSlug, actorName })
```

**2. `update()` — status changed**
After the transaction completes, if `dto.status` differs from `existingTask.status` and the assignee is human:
```ts
notificationService.create(agent.userId, NotificationType.TASK_STATUS_CHANGED, { ..., oldStatus, newStatus })
```

**3. `addComment()` — comment added**
If the task has a human assignee and the commenter is not the assignee:
```ts
notificationService.create(agent.userId, NotificationType.TASK_COMMENTED, { ..., actorName, commentSnippet })
```

Resolving `userId` from `assigneeId` (a `ProjectAgent` id) requires joining `ProjectAgent → Agent → userId`. This join is already done in `TasksService` when checking `agent.type === 'AI'` for the runner enqueue logic.

### Email

`NotificationService` uses `@resend/node` (one npm package, no SMTP). A private `sendEmail()` method renders a minimal HTML string per notification type and calls `resend.emails.send()`. If `RESEND_API_KEY` is not set, `sendEmail()` returns early — local dev works without it.

Email subjects by type:
- `TASK_ASSIGNED` → "You've been assigned: {taskTitle}"
- `TASK_COMMENTED` → "{actorName} commented on: {taskTitle}"
- `TASK_STATUS_CHANGED` → "{taskTitle} is now {newStatus}"

### My Tasks endpoint

New `MyTasksController` at `apps/api/src/modules/my-tasks/` with a single endpoint:

```
GET /my-tasks
```

JWT-gated. Returns tasks assigned to the current user across all projects, ordered by `updatedAt` desc. Includes `project` relation (for name and `workspace.slug`).

Query path: `User.id → Agent.userId (reverse) → ProjectAgent.agentId (reverse) → Task.assigneeId`.

```ts
// Pseudocode
const agents = await prisma.agent.findMany({ where: { userId: currentUser.id } })
const projectAgentIds = agents.flatMap(a => a.projectAgents.map(pa => pa.id))
const tasks = await prisma.task.findMany({
  where: { assigneeId: { in: projectAgentIds }, deletedAt: null },
  include: { project: { include: { workspace: true } } },
  orderBy: { updatedAt: 'desc' },
})
```

---

## Frontend

### Navigation

Add "My Tasks" link to the app header in `apps/app/app/[locale]/(app)/layout.tsx` (or wherever the top nav is rendered). Uses `Link` with `buttonVariants` per the existing pattern — not `Button asChild`.

### My Tasks page — `/[locale]/(app)/my-tasks/page.tsx`

- Fetches `GET /tasks/my-tasks` via TanStack Query
- Groups results by `projectId` client-side
- Renders each project as a section header with task rows:
  - Task title
  - Status badge (color-coded, matches board colors)
  - Priority indicator
  - Last updated timestamp
- Clicking a row opens the existing `TaskDetail` sheet component — reused as-is
- Worker has full status control through `TaskDetail` (same `PATCH /tasks/:id` endpoint, JWT-gated)
- Empty state: "No tasks assigned to you yet."

### Notification bell — `NotificationBell` component

Added to the app header. On mount:
1. Fetches `GET /notifications` (initial list, unread count)
2. Subscribes to the Socket.io personal room `user:{userId}` for `notification:created` events

Bell shows an unread count badge (disappears when all read).

On click: dropdown showing last 10 notifications:
- Icon per type (📋 assigned, 💬 commented, 🔄 status changed)
- Title line: e.g. "Assigned: Design onboarding flow"
- Subtitle: project name + time ago
- Each notification links to the board: `/workspaces/[slug]/projects/[projectId]/board`
- "Mark all read" button at the bottom

Clicking a notification: marks it read (`PATCH /notifications/:id/read`), navigates to the board.

### Socket.io hook

New `useNotifications(userId)` hook (mirrors the existing `useKanbanSocket` pattern):
- Joins `user:{userId}` room on mount
- Listens for `notification:created`
- Returns `{ notifications, unreadCount, markRead, markAllRead }`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | No (skips email if absent) | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | No (defaults to `noreply@openworkspace.dev`) | From address for notification emails |

---

## Testing

- `NotificationService`: unit tests — `create()` writes to DB, emits to gateway, calls email (mocked); `markAllRead()` updates correct rows
- `TasksService` spec: existing tests unaffected; new test for `create()` with human assignee triggers `notificationService.create()`
- Frontend: `NotificationBell` renders unread count, dropdown renders notification list, mark-all-read clears badge
