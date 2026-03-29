# Architecture Design

## Overview

OpenWorkspace is a SaaS platform where humans and AI agents collaborate on projects via a Kanban board. The platform is split into focused apps within a pnpm monorepo, each deployable independently and served from its own subdomain.

---

## Monorepo Structure

```
openworkspace/
├── apps/
│   ├── website/       ← Public marketing site (Next.js)
│   ├── app/           ← SaaS frontend — dashboard, Kanban, marketplace (Next.js)  [was: apps/web]
│   ├── api/           ← REST API + WebSocket gateway (NestJS)
│   └── runner/        ← Dedicated agent runner service (Python)                   [new]
├── packages/
│   ├── shared/        ← Enums and TypeScript types shared across all apps          [existing]
│   ├── ui/            ← Shared shadcn/ui component library                         [new]
│   └── api-types/     ← Auto-generated or hand-maintained API contract types       [new]
├── docker-compose.yml
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Apps

### `apps/website` — Public Marketing Site
- **Subdomain:** `yourproduct.com` / `www.yourproduct.com`
- **Framework:** Next.js (App Router, static-first)
- **Purpose:** Landing page, pricing, feature tour, docs, blog
- **Auth:** None (public)
- **Shares:** `packages/ui` (design tokens, common components), `packages/shared`
- **Deployment:** Vercel / CDN-friendly (mostly static)

### `apps/app` — SaaS Platform Frontend _(was `apps/web`)_
- **Subdomain:** `app.yourproduct.com`
- **Framework:** Next.js (App Router, client-heavy)
- **Purpose:** Authenticated user experience — workspaces, projects, Kanban board, agent marketplace, billing, provider dashboard
- **Auth:** Firebase Auth (client-side) → sends JWT to `apps/api`
- **Shares:** `packages/ui`, `packages/shared`, `packages/api-types`
- **Deployment:** Vercel

### `apps/api` — REST API + WebSocket Gateway
- **Subdomain:** `api.yourproduct.com`
- **Framework:** NestJS
- **Purpose:** All business logic — workspaces, projects, tasks, agents, marketplace, billing, keys, planner; Socket.io gateway for real-time Kanban updates
- **Auth:** Firebase Admin SDK (`verifyIdToken`) + Project Key guard (for AI agents)
- **Shares:** `packages/shared`, `packages/api-types`
- **Deployment:** Railway / Fly.io (persistent Node process)
- **Note:** Does NOT run the agent agentic loop — delegates to `apps/runner` via Redis Streams

### `apps/runner` — Agent Runner Service _(Python)_
- **Subdomain:** Internal only — no public-facing HTTP (queue consumer only)
- **Language:** Python 3.12+
- **Runtime:** `asyncio` with `uvloop`
- **Purpose:** Executes the agentic loop for platform-run AI agents
  - Consumes jobs from the `agent-runs` Redis Stream via consumer groups
  - Calls LLM providers (OpenAI, Anthropic, Gemini) using `httpx`
  - Executes MCP tools (get_task, update_task, add_comment, etc.)
  - Writes AgentRunLog steps and posts task comments via direct Postgres writes (`asyncpg`)
  - Publishes Kanban events to `kanban:events` Redis pub/sub channel (picked up by `apps/api` gateway)
- **Key dependencies:** `redis[asyncio]`, `asyncpg`, `httpx`, `python-dotenv`
- **Deployment:** Railway / Fly.io — scaled independently of `apps/api`
- **Scaling:** Multiple runner instances form a Redis Stream consumer group; each job is processed by exactly one instance

---

## Shared Packages

### `packages/shared` _(existing)_
- TypeScript enums and plain types used by both frontend and backend
- No runtime dependencies — pure TypeScript
- Currently contains: task/project/agent enums

### `packages/ui` _(new)_
- Shared shadcn/ui component library
- Used by `apps/website` and `apps/app`
- Avoids duplicating Tailwind config, component variants, design tokens
- Components: Button, Card, Badge, Input, Select, Dialog, etc.

### `packages/api-types` _(new)_
- TypeScript types describing the API request/response shapes
- Maintained by hand (or generated from NestJS Swagger schema)
- Used by `apps/app` (API client) and `apps/api` (DTOs cross-reference)
- Keeps `apps/app`'s `lib/api.ts` type-safe without a full codegen pipeline

---

## Infrastructure & Communication

```
                        ┌─────────────────────┐
  yourproduct.com  ───► │   apps/website       │  (Vercel, static)
                        └─────────────────────┘

                        ┌─────────────────────┐
  app.yourproduct.com ─►│   apps/app           │  (Vercel)
                        └──────────┬──────────┘
                                   │ HTTPS + JWT
                        ┌──────────▼──────────┐
  api.yourproduct.com ─►│   apps/api           │  (Railway/Fly)
                        └──────┬──────┬───────┘
                               │      │
                  Redis Stream │    Redis pub/sub
                  XADD to      │      │ kanban:events
                  agent-runs   │      │ (WS events back to clients)
                        ┌──────▼──────▼───────┐
                        │   apps/runner        │  (Railway/Fly, scaled)
                        │   (Python)           │
                        └─────────────────────┘
                                   │
                          LLM APIs (OpenAI, Anthropic, Gemini)
```

### Key communication paths

| From | To | Protocol | Details |
|---|---|---|---|
| `apps/app` | `apps/api` | HTTPS REST + WebSocket | JWT auth |
| `apps/api` | `apps/runner` | Redis Stream (`XADD`) | Stream: `agent-runs`, group: `runner-group` |
| `apps/runner` | Postgres | `asyncpg` | Direct DB writes (AgentRunLog, Task, TaskComment) |
| `apps/runner` | `apps/api` WS clients | Redis pub/sub (`PUBLISH`) | Channel: `kanban:events`; `apps/api` subscribes and forwards to Socket.io |
| `apps/runner` | LLM providers | HTTPS (`httpx`) | OpenAI / Anthropic / Gemini |

### Redis Stream job format

`apps/api` publishes to stream `agent-runs`:
```
XADD agent-runs * \
  taskId         <id> \
  agentId        <id> \
  projectAgentId <id> \
  projectId      <id> \
  workspaceId    <id> \
  runLogId       <id>
```

`apps/runner` reads with consumer groups (`XREADGROUP`), ACKs on success, leaves unACKed on failure for retry/DLQ handling.

---

## Migration Plan

### Phase 1 — Rename & restructure ✅ Done
1. `apps/web` → `apps/app`
2. `apps/website` scaffolded (Next.js)
3. Root `package.json` scripts updated

### Phase 2 — `apps/runner` in Python
1. Remove NestJS runner scaffold
2. Create Python project with `asyncio`, `redis[asyncio]`, `asyncpg`, `httpx`
3. Implement Redis Stream consumer with consumer groups
4. Port agentic loop and MCP tools from NestJS processor
5. Update `apps/api` to publish jobs via `XADD` instead of BullMQ enqueue
6. Remove `@nestjs/bullmq` from `apps/api` (BullMQ no longer needed there)

### Phase 3 — Extract `packages/ui`
1. Move shadcn/ui components from `apps/app/components/ui/` to `packages/ui/`
2. Update imports in `apps/app`; use from `apps/website`

### Phase 4 — Add `packages/api-types`
1. Define request/response types for key API endpoints
2. Replace `Record<string, unknown>` casts in `apps/app/lib/api.ts`

---

## Environment Variables

Each app has its own `.env`. Shared infrastructure values appear in multiple apps.

| Variable | website | app | api | runner |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | — | ✓ | — | — |
| `NEXT_PUBLIC_FIREBASE_*` | — | ✓ | — | — |
| `FIREBASE_*` (admin) | — | — | ✓ | — |
| `DATABASE_URL` | — | — | ✓ | ✓ |
| `REDIS_HOST` | — | — | ✓ | ✓ |
| `REDIS_PORT` | — | — | ✓ | ✓ |
| `ENCRYPTION_SECRET` | — | — | ✓ | ✓ |
| `JWT_SECRET` | — | — | ✓ | — |
| `STRIPE_*` | — | — | ✓ | — |

---

## Decision Log

| Decision | Rationale |
|---|---|
| Separate `apps/runner` from `apps/api` | Agent runs are CPU/network heavy and long-running; isolating them prevents slow agents from impacting API latency |
| Python for `apps/runner` | Richer LLM ecosystem; cleaner `asyncio`-native concurrency for I/O-heavy agentic loops; easier to integrate future ML tooling |
| Redis Streams over BullMQ | BullMQ is Node.js-specific; Redis Streams are language-agnostic, built into Redis, support consumer groups for parallel processing and at-least-once delivery with ACK |
| Consumer groups for runner scaling | Multiple Python runner instances read from the same stream; each job delivered to exactly one instance; failed (unACKed) jobs are claimable by other instances |
| Shared Postgres DB (not separate DBs per service) | Avoids distributed transactions; runner needs direct write access to AgentRunLog, Task, TaskComment |
| Redis pub/sub for WS events from runner | Runner has no HTTP server; publishes to `kanban:events` channel; `apps/api` KanbanGateway subscribes and forwards to Socket.io clients |
| `packages/ui` shared component library | Ensures brand consistency between marketing site and app without duplicating Tailwind config |
