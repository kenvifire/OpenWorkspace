# apps/api — NestJS REST API

## Overview

The API is a NestJS application that serves as the central control plane for OpenWorkspace. It exposes a REST API consumed by the web app, handles authentication for both human users and AI agents, manages all business logic, and drives the real-time Kanban gateway.

- **Port**: 3001
- **Global prefix**: `/api`
- **Swagger**: `http://localhost:3001/api/docs`
- **Framework**: NestJS 10, TypeScript, Prisma v6, ioredis

---

## Module Map

```
src/
├── main.ts                     Bootstrap, CORS, ValidationPipe, Swagger
├── app.module.ts               Root module — imports all feature modules
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts   JwtAuthGuard — verifies HS256 JWT
│   │   └── project-key.guard.ts ProjectKeyGuard — agent x-project-key auth
│   ├── decorators/
│   │   ├── current-user.decorator.ts   @CurrentUser() → User entity
│   │   └── current-agent.decorator.ts  @CurrentAgent() → ProjectAgent entity
│   └── filters/
│       └── http-exception.filter.ts    Global error envelope
├── gateway/
│   ├── gateway.module.ts
│   └── kanban.gateway.ts       Socket.io /kanban gateway + Redis subscriber
└── modules/
    ├── prisma/                 Global PrismaService singleton
    ├── auth/                   Firebase Admin verify + JWT issuance
    ├── workspaces/             Workspace CRUD + member management
    ├── projects/               Project CRUD + hire-agent + agreement flow
    ├── tasks/                  Kanban task CRUD + auto-trigger
    ├── agents/                 Provider registration + DPA + agent CRUD + reviews
    ├── marketplace/            Public search, filter, paginate agents
    ├── keys/                   Resource key CRUD (AES-256-GCM) + audit log
    ├── workspace-keys/         Workspace LLM provider key management
    ├── planner/                AI-driven project planning
    ├── billing/                Usage recording + cycle summary + Stripe
    └── agent-runner/           Redis Stream producer + run log management
```

---

## Authentication

### Human users — JWT guard

1. Client calls `POST /api/auth/login` with a Firebase ID token.
2. API calls Firebase Admin `verifyIdToken()` (via `HttpsProxyAgent` if `HTTPS_PROXY` is set).
3. API upserts a `User` row (by `firebaseUid`), then signs and returns its own HS256 JWT (`JWT_SECRET`).
4. All subsequent requests send `Authorization: Bearer <jwt>`. `JwtAuthGuard` verifies it and attaches `req.user`.

### AI/human agents — Project Key guard

- Agent sends `x-project-key: <rawKey>` header.
- `ProjectKeyGuard` computes `SHA-256(rawKey)` and looks up `ProjectAgent.projectKey`.
- Also enforces: (a) `ProjectAgreement` exists for this agent, (b) `ProjectAgent.revokedAt` is null.
- On success, attaches `req.agent` (the `ProjectAgent` entity including project + workspace).

---

## Module Details

### auth
- `POST /api/auth/login` — verify Firebase token, upsert `User`, return JWT
- `GET /api/auth/me` — return current user (JWT-guarded)

### workspaces
- `POST /api/workspaces` — create workspace, auto-add creator as OWNER member
- `GET /api/workspaces` — list user's workspaces (with `_count`)
- `GET /api/workspaces/:slug` — detail (with members, project count)
- `POST /api/workspaces/:slug/members/invite` — invite by email, add as MEMBER

### projects
- `POST /api/workspaces/:wsId/projects` — create project, creator becomes leader
- `GET /api/workspaces/:wsId/projects` — list (workspace members only)
- `GET /api/projects/:id` — detail with hired agents and their agreement status
- `POST /api/projects/:id/agents/hire` — hire agent (leader only)
  - Creates `ProjectAgent`, generates `rawKey` (returned once), stores SHA-256 hash
  - Returns `{projectAgentId, rawProjectKey, agreementType, message}`
- `POST /api/projects/:id/agents/:paId/accept-agreement` — activate the project key
  - AI agents: called by provider owner
  - Human agents: called after DocuSign callback
- `DELETE /api/projects/:id/agents/:paId` — revoke (soft-delete via `revokedAt`)

### tasks
Dual-access: humans use JWT, agents use Project Key. Both paths converge on the same service.

- `GET /api/projects/:id/tasks` — list all tasks with assignee + comment count
- `GET /api/projects/:id/tasks/:taskId` — detail with comments + activity log
- `POST /api/projects/:id/tasks` — create task
- `PATCH /api/projects/:id/tasks/:taskId` — update (status change creates `TaskActivity`)
- `POST /api/projects/:id/tasks/:taskId/comments` — add comment
- `POST /api/projects/:id/tasks/:taskId/run` — manually trigger agent run
- `POST /api/projects/:id/tasks/:taskId/stop` — stop a running agent

**Auto-trigger logic** (`maybeEnqueueAgent`): called after every `create` or `update`. If `task.status === TODO` and the assignee is an AI `ProjectAgent` with no current `RUNNING` log, it calls `AgentRunnerService.enqueue()`.

### agents
Provider management + agent CRUD:
- `POST /api/agents/providers` — register as a provider
- `POST /api/agents/providers/dpa` — accept Data Processing Agreement
- `POST /api/agents` — create agent (provider only)
- `PATCH /api/agents/:id` — update agent config (LLM fields, system prompt, tools)
- `POST /api/agents/:id/publish` / `unpublish` — control marketplace visibility
- `POST /api/agents/:id/reviews` — leave a review after working with an agent
- `POST /api/agents/:id/reviews/:reviewId/respond` — provider responds to review

### marketplace
Public read-only:
- `GET /api/marketplace` — search, filter (`type`, `pricingModel`, tag), paginate (`page`, `limit`)
- `GET /api/marketplace/tags` — distinct capability tag list
- `GET /api/marketplace/:id` — agent detail with provider info, ratings, reviews

### keys (resource keys)
Per-project secret storage:
- `POST /api/projects/:id/keys` — store an encrypted secret (AES-256-GCM)
- `GET /api/projects/:id/keys` — list keys (names only, values never returned)
- `GET /api/projects/:id/keys/:keyId/reveal` — decrypt and return value (JWT-guarded, audit-logged)
- `DELETE /api/projects/:id/keys/:keyId` — delete

Agents access keys via the `get_resource_key` MCP tool (direct Postgres + Python decrypt), which also writes an `AuditLog` row.

### workspace-keys
Per-workspace LLM provider API keys:
- `GET /api/workspaces/:wsId/keys` — list providers configured
- `PUT /api/workspaces/:wsId/keys/:provider` — upsert (creates or updates encrypted key)
- `DELETE /api/workspaces/:wsId/keys/:provider` — remove

Used as fallback when an agent doesn't have its own `encryptedApiKey`.

### planner
AI-assisted project planning:
- `POST /api/projects/:id/planner/set` — assign an AI `ProjectAgent` as planner (leader only)
- `DELETE /api/projects/:id/planner` — unset planner
- `POST /api/projects/:id/planner/run` — call LLM to generate `{roles, tasks}` draft (no DB writes)
- `POST /api/projects/:id/planner/accept` — commit draft → create `BACKLOG` tasks in bulk

The planner calls the LLM directly via `fetch` (OpenAI-compatible, `response_format: json_object`). Supports OpenAI, Anthropic (via OpenAI-compatible endpoint), and Gemini.

### billing
- `GET /api/billing/:wsId/summary` — current month usage by project → agent
- `POST /api/billing/:wsId/usage` — record a billing event (internal/trusted callers)
- `POST /api/billing/:wsId/checkout` — create Stripe Checkout session
- `POST /api/billing/webhook/stripe` — Stripe webhook handler (raw body)
- `GET /api/billing/provider/earnings` — current month earnings for provider

### agent-runner
- `AgentRunnerService.enqueue(taskId, projectAgentId)` — creates `AgentRunLog` + `XADD` to Redis Stream
- `AgentRunnerService.stop(taskId)` — sets `AgentRunLog.status = STOPPED`
- `GET /api/projects/:id/tasks/:taskId/runs` — list run logs for a task
- `GET /api/projects/:id/tasks/:taskId/runs/:runId` — single run log with step JSON

---

## KanbanGateway

Namespace: `/kanban`
Protocol: Socket.io over WebSocket
CORS: mirrors `WEB_URL` env var

**Client → Server messages:**
- `join:project` (payload: `projectId`) — join room `project:{projectId}`
- `leave:project` (payload: `projectId`) — leave room

**Server → Client events:**
- `task:created` — full task object
- `task:updated` — updated task object
- `task:deleted` — `{id}`
- `comment:created` — comment object with `taskId`

Two event sources:
1. `TasksService` calls `gateway.emit()` directly (same process).
2. An ioredis `subscriber` connection subscribes to `kanban:events` Redis pub/sub channel. Messages from the Python runner arrive here and are forwarded to the appropriate Socket.io room.

---

## Database Schema (key models)

| Model | Key Fields |
|-------|-----------|
| `User` | id, firebaseUid, email, name, avatarUrl |
| `Workspace` | id, slug, name, ownerId |
| `WorkspaceMember` | workspaceId, userId, role (OWNER/ADMIN/MEMBER) |
| `Project` | id, workspaceId, leaderId, name, description, plannerProjectAgentId |
| `Agent` | id, providerId, name, type (AI/HUMAN), llmProvider, modelName, systemPrompt, encryptedApiKey, temperature, maxTokens, maxIterations, enabledTools[], isPublished |
| `ProjectAgent` | id, projectId, agentId, role, projectKey (SHA-256), isCoordinator, hiredAt, revokedAt |
| `ProjectAgreement` | id, projectAgentId, agreementType, acceptedAt, dpaVersionInEffect |
| `Task` | id, projectId, assigneeId (FK→ProjectAgent), status, priority, reporterType |
| `TaskComment` | id, taskId, authorId, authorType (user/agent), content |
| `TaskActivity` | id, taskId, actorId, actorType, action, metadata |
| `AgentRunLog` | id, taskId, agentId, projectAgentId, status (RUNNING/COMPLETED/STOPPED/FAILED/MAX_ITERATIONS), iterations, log (JSONB), startedAt, finishedAt |
| `ResourceKey` | id, projectId, name, encryptedValue |
| `WorkspaceProviderKey` | workspaceId, provider, encryptedKey |
| `BillingRecord` | id, workspaceId, projectId, projectAgentId, event, amountCents, tokenCount |
| `AuditLog` | id, workspaceId, projectId, actorId, actorType, action, resourceType, resourceId |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_HOST` | Yes | Redis hostname |
| `REDIS_PORT` | Yes | Redis port (default 6379) |
| `JWT_SECRET` | Yes (dev) | HS256 signing key |
| `ENCRYPTION_SECRET` | Yes | AES-256-GCM key derivation secret |
| `STRIPE_SECRET_KEY` | No | Stripe secret (Checkout disabled without it) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature verification |
| `WEB_URL` | No | CORS origin (default `http://localhost:3000`) |
| `PORT` | No | HTTP port (default 3001) |
