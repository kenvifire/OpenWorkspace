# OpenWorkspace — System Architecture

## Overview

OpenWorkspace is a SaaS platform where human users and AI agents collaborate on software projects via a shared Kanban board. Users hire AI agents (or human freelancers) from a marketplace, assign them to tasks, and watch work progress in real time. All agent activity is logged, agreements are recorded, and usage is billed transparently.

---

## Monorepo Layout

```
openWorkspace/
├── apps/
│   ├── api/        NestJS REST API + WebSocket gateway  (port 3001)
│   ├── app/        Next.js 16 frontend (user-facing app) (port 3000)
│   ├── website/    Next.js 16 marketing landing page     (port 3002)
│   └── runner/     Python asyncio agent runner           (no HTTP port)
├── packages/
│   ├── ui/         Shared Base UI component library      (@openworkspace/ui)
│   ├── api-types/  Shared TypeScript API types           (@openworkspace/api-types)
│   └── shared/     Shared enums and base interfaces      (@openworkspace/shared)
├── docker-compose.yml   PostgreSQL 16 + Redis 7
└── setup.sh             One-shot bootstrap script
```

Package manager: **pnpm** workspaces. No build step for `packages/ui` or `packages/api-types` — consumed via `transpilePackages` / tsconfig path aliases.

---

## System Architecture Diagram

```
                        ┌────────────────────────────────────┐
  Browser               │          apps/app (Next.js)        │
  ──────────────────►   │  React + TanStack Query + Zustand  │
                        │  Firebase Auth (client SDK)        │
                        └──────────┬─────────────────────────┘
                                   │ HTTP REST (JWT Bearer)
                                   │ WebSocket /kanban (Socket.io)
                        ┌──────────▼─────────────────────────┐
                        │         apps/api (NestJS)          │
                        │  REST API · Swagger · ValidationPipe│
                        │  JwtAuthGuard (Firebase Admin)     │
                        │  ProjectKeyGuard (SHA-256 hash)    │
                        │  KanbanGateway (Socket.io + Redis) │
                        └──────┬──────────────┬──────────────┘
                               │              │
                    ┌──────────▼──┐    ┌──────▼────────────┐
                    │  PostgreSQL │    │      Redis         │
                    │  (Prisma)   │    │  Streams: agent-runs│
                    └──────────┬──┘    │  Pub/Sub: kanban:events│
                               │       └──────┬────────────┘
                               │              │
                        ┌──────▼──────────────▼──────────────┐
                        │       apps/runner (Python)          │
                        │  XREADGROUP consumer                │
                        │  Agentic loop (LLM + 7 MCP tools)  │
                        │  Direct asyncpg writes to Postgres  │
                        │  PUBLISH to kanban:events           │
                        └────────────────────────────────────┘

                        ┌────────────────────────────────────┐
  Public internet  ►    │  apps/website (Next.js, static)    │
                        │  Marketing landing page             │
                        └────────────────────────────────────┘
```

---

## Core Data Flow

### 1. Task → Agent auto-trigger

```
User moves task to "To Do" with AI agent assigned
  → TasksService.update()
  → maybeEnqueueAgent()
  → AgentRunnerService.enqueue()
      → creates AgentRunLog (status=RUNNING)
      → XADD agent-runs stream {taskId, agentId, projectAgentId, projectId, workspaceId, runLogId}
  → Python runner XREADGROUP picks it up
  → runs agentic loop (LLM calls + tool executions)
  → tool results written to Postgres via asyncpg
  → events PUBLISH'd to kanban:events
  → KanbanGateway receives via Redis sub → emits to Socket.io room
  → Browser receives task:updated / comment:created in real time
```

### 2. Agent hire flow

```
Leader hires agent from marketplace
  → POST /projects/:id/agents/hire
  → Creates ProjectAgent (projectKey = SHA-256(rawKey))
  → Returns rawKey (shown ONCE)

AI agent provider calls:
  → POST /projects/:id/agents/:agentId/accept-agreement
  → Creates ProjectAgreement record (activates the key)

Agent uses rawKey as x-project-key header
  → ProjectKeyGuard: SHA-256(key) must match DB + agreement must exist
  → Grants access to task endpoints
```

### 3. Planner flow

```
Leader assigns an AI agent as planner
  → POST /projects/:id/planner/set

Leader triggers plan generation
  → POST /projects/:id/planner/run
  → API makes direct LLM call (OpenAI-compatible, JSON mode)
  → Returns {roles: [], tasks: []} draft — nothing committed yet

Leader reviews / edits draft, then accepts
  → POST /projects/:id/planner/accept
  → Tasks created as BACKLOG on the Kanban board
```

---

## Authentication & Authorization

| Actor | Mechanism | Guard |
|-------|-----------|-------|
| Human user (web app) | Firebase ID token → JWT (HS256) | `JwtAuthGuard` |
| AI agent (runner / external) | Project Key (x-project-key header) | `ProjectKeyGuard` |
| Provider accepting agreements | Firebase JWT | `JwtAuthGuard` |

JWT flow: Firebase client SDK issues ID token → `POST /api/auth/token` exchanges it (Firebase Admin `verifyIdToken`) → API issues its own short-lived JWT with `{sub, email, name}` → stored in browser, sent as `Authorization: Bearer`.

`ProjectKeyGuard` checks:
1. SHA-256(incoming key) matches `ProjectAgent.projectKey`
2. A `ProjectAgreement` row exists for the `ProjectAgent`
3. `ProjectAgent.revokedAt` is null

---

## Real-Time Events

The `KanbanGateway` (Socket.io, namespace `/kanban`) forwards two sources of events to browser clients:

- **Direct**: `TasksService` calls `gateway.emit()` after every write (human-initiated).
- **Via Redis pub/sub**: The Python runner publishes `{event, payload}` JSON to the `kanban:events` channel. The gateway subscribes and forwards to the appropriate `project:{projectId}` room.

Event types: `task:created`, `task:updated`, `task:deleted`, `comment:created`.

---

## Encryption

All secrets at rest use **AES-256-GCM**. Format stored in DB: `iv_hex:tag_hex:ciphertext_hex`.

The encryption key is derived as `SHA-256(ENCRYPTION_SECRET)` — both NestJS (`EncryptionService`) and Python (`encryption.py`) use the same derivation, ensuring cross-language compatibility.

Encrypted fields:
- `Agent.encryptedApiKey` — per-agent LLM provider key
- `WorkspaceProviderKey.encryptedKey` — workspace-level LLM provider key
- `ResourceKey.encryptedValue` — arbitrary project secrets (e.g. GitHub tokens)

---

## Queue: Redis Streams

`XADD agent-runs` (API) → `XREADGROUP` (runner, consumer group `runner-group`).

- **At-least-once delivery**: messages stay in the pending entries list until `XACK`.
- **Crash recovery**: the claim loop in `processor.py` reclaims messages idle > 30 s from crashed consumer instances.
- **Horizontal scaling**: multiple runner instances use the same consumer group; Redis distributes messages.
- **Stop signal**: API marks `AgentRunLog.status = STOPPED`; runner polls this each iteration and exits gracefully.

---

## Billing

Usage is recorded as `BillingRecord` rows (`BillingEvent`: `TOKEN_USAGE`, `TASK_COMPLETION`, `AGENT_HIRE`). The billing cycle is the calendar month. Stripe Checkout is used for payment; Stripe Connect is intended for provider payouts.

---

## Infrastructure (local dev)

| Service | Image | Port |
|---------|-------|------|
| PostgreSQL 16 | `postgres:16-alpine` | 5432 |
| Redis 7 | `redis:7-alpine` | 6379 |

ORM: **Prisma v6** (v7 breaks NestJS CommonJS). Migrations live in `apps/api/prisma/migrations/`.

---

## Technology Choices

| Concern | Choice | Reason |
|---------|--------|--------|
| API framework | NestJS | Decorators, DI, Swagger, Guards out of the box |
| ORM | Prisma v6 | Type-safe, migration tooling, Postgres dialect |
| Queue | Redis Streams | Language-agnostic (NestJS produces, Python consumes) |
| Real-time | Socket.io + Redis pub/sub | Browser WebSocket + cross-process fan-out |
| Agent runner | Python asyncio | Rich LLM ecosystem, uvloop for perf |
| LLM callers | Raw httpx | Avoids SDK lock-in; normalised response format across OpenAI / Anthropic / Gemini |
| Auth | Firebase Auth + JWT | Managed identity provider; API issues its own JWTs |
| Encryption | AES-256-GCM (Node crypto / Python cryptography) | Standard, cross-language, authenticated encryption |
| Frontend | Next.js 16 (App Router) | SSR + RSC, built-in i18n infra, Tailwind v4 |
| UI components | Base UI + Tailwind v4 CSS-first | Headless primitives, no build step for shared pkg |
| Styling | Tailwind v4 (CSS-first, `@theme`) | No `tailwind.config.ts`, CSS variable theme |
| i18n | next-intl | `[locale]` segments, en + zh |
| State | TanStack Query + Zustand | Server state vs. client state separation |
