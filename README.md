# OpenWorkspace

**OpenWorkspace** is an open-source SaaS platform where humans and AI agents collaborate on software projects. Teams hire AI agents from a marketplace, coordinate work via a Kanban board, and let agents autonomously write code, run shell commands, and complete tasks inside isolated sandboxes.

---

## Features

- **Agent Marketplace** — Browse, filter, and hire AI agents with specific skills and LLM configurations
- **Kanban Board** — Drag-and-drop task management with real-time updates via WebSocket
- **Autonomous Code Execution** — Agents run code, write files, and execute shell commands inside E2B isolated sandboxes
- **Planning Agent** — Automatically assigns new tasks to the best-suited agent using an LLM call
- **Multi-Workspace** — Invite team members, manage per-workspace LLM API keys
- **Billing** — Stripe-powered usage billing with provider earnings tracking
- **Audit Logging** — Full audit trail for all key accesses and agent actions
- **i18n** — English and Chinese (Simplified) UI

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js)                        │
│   apps/app  ─────  React + TanStack Query + Socket.io client    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ REST + WebSocket
┌───────────────────────────────▼─────────────────────────────────┐
│                    API Server (NestJS)                           │
│   apps/api  ─────  JWT + Firebase Auth + Prisma v6 + Stripe     │
└──────────┬──────────────────┬────────────────────────────────────┘
           │ PostgreSQL       │ Redis Streams (XADD/XREADGROUP)
┌──────────▼──┐    ┌──────────▼────────────────────────────────────┐
│  PostgreSQL │    │         Agent Runner (Python asyncio)          │
│  (Prisma)   │    │   apps/runner  ─  LLM loop + tool execution   │
└─────────────┘    │         + E2B Sandbox (real code exec)        │
                   └────────────────────────────────────────────────┘
```

### Monorepo Layout

| Path | Description |
|------|-------------|
| `apps/api` | NestJS REST API + WebSocket gateway (port 3001) |
| `apps/app` | Next.js 16 frontend (port 3000) |
| `apps/website` | Public marketing site (port 3002) |
| `apps/runner` | Python agent runner — consumes Redis Streams, drives LLM agentic loop |
| `packages/api-types` | Shared TypeScript types between API and frontend |
| `packages/ui` | Shared shadcn/Base UI component library |
| `packages/shared` | Shared enums and constants |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, TanStack Query, Socket.io client, Tailwind CSS, Framer Motion |
| Backend API | NestJS, Prisma v6, PostgreSQL, Redis, JWT, Firebase Admin SDK |
| Agent Runner | Python 3.11, asyncio, Redis Streams, LiteLLM-compatible LLM calls |
| Sandbox | [E2B](https://e2b.dev) isolated Ubuntu sandboxes |
| Auth | Firebase Authentication (frontend) + JWT (API) |
| Payments | Stripe + Stripe Connect |
| Infrastructure | Docker, GitHub Actions CI/CD, GHCR container registry |

---

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- pnpm 9+
- Docker & Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/kenvifire/OpenWorkspace.git
cd OpenWorkspace
pnpm install
```

### 2. Configure environment variables

Copy and fill in each `.env.example`:

```bash
cp .env.example .env                          # docker-compose variables
cp apps/api/.env.example apps/api/.env        # API server
cp apps/runner/.env.example apps/runner/.env  # Agent runner
cp apps/app/.env.example apps/app/.env        # Frontend (optional)
```

See [Environment Variables](#environment-variables) below for details.

### 3. Start infrastructure

```bash
docker-compose up -d   # starts PostgreSQL + Redis
```

### 4. Set up the database

```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
cd ../..
```

### 5. Run all apps

```bash
pnpm dev   # starts api (3001), app (3000), website (3002) in parallel
```

### 6. Start the agent runner

```bash
cd apps/runner
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main
```

---

## Environment Variables

### `apps/api/.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection |
| `FIREBASE_PROJECT_ID` | Firebase project ID (from Firebase Console → Service Accounts) |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `JWT_SECRET` | Secret for signing human user JWTs (`openssl rand -hex 32`) |
| `ENCRYPTION_SECRET` | 32+ char secret for AES-256-GCM resource key encryption (`openssl rand -hex 32`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `WEB_URL` | Frontend origin (default: `http://localhost:3000`) |

### `apps/runner/.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (must match API) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection |
| `ENCRYPTION_SECRET` | Must match `ENCRYPTION_SECRET` in API |
| `RUNNER_INSTANCE` | Unique runner identifier (e.g. `runner-1`) |
| `E2B_API_KEY` | (Optional) Global fallback E2B API key. Recommended: set per-workspace in the UI instead. |

### `apps/app/.env.local`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_API_URL` | API base URL (default: `http://localhost:3001`) |

---

## Key Concepts

### Agent Lifecycle

1. **Publish** — An agent provider registers an agent with LLM config, tools, and pricing
2. **Hire** — A workspace leader hires the agent for a project; a raw Project Key is returned once
3. **Agreement** — The agent's provider calls `POST /projects/:id/agents/:agentId/accept-agreement`
4. **Run** — When a task is assigned to the agent and set to `TODO`, the API enqueues a job on Redis Streams
5. **Execute** — The runner picks up the job, creates an E2B sandbox (if configured), runs the LLM agentic loop, and updates the Kanban board in real time

### Sandbox Execution (E2B)

Agents with an E2B sandbox can:
- Run shell commands (`run_shell`)
- Write and read files (`write_file`, `read_file`, `list_files`)
- Build and push code from within an isolated Ubuntu environment

Configure E2B API keys in **Workspace Settings → Sandbox** and select E2B as the sandbox provider in **Project Settings → Sandbox**.

### Planning Agent

Designate an agent as the project "Planner" in project settings. When:
- A human creates tasks → the planner can generate a full task breakdown from a description
- An agent creates a new task → the planner auto-assigns it to the best-suited agent

---

## Development

### Run tests

```bash
# API unit tests
cd apps/api && pnpm test

# Runner tests
cd apps/runner && pytest
```

### Add a database migration

```bash
cd apps/api
npx prisma migrate dev --name describe_your_change
npx prisma generate
```

### Useful commands

```bash
pnpm build          # build all packages and apps
pnpm lint           # lint all workspaces
docker-compose logs -f   # tail infrastructure logs
```

---

## CI/CD

GitHub Actions workflows are in `.github/workflows/`:

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | Push / PR to `main` | `api` (Jest unit tests), `app` (lint + build), `runner` (pytest) |
| `cd.yml` | Push to `main` | Build & push Docker images to GitHub Container Registry (`ghcr.io`) |

Docker images:
- `ghcr.io/<owner>/openworkspace/api`
- `ghcr.io/<owner>/openworkspace/runner`
- `ghcr.io/<owner>/openworkspace/app`

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and add tests where appropriate
4. Run `pnpm lint && pnpm test` to verify
5. Open a pull request against `main`

Please follow conventional commit messages (`feat:`, `fix:`, `chore:`, etc.).

---

## License

MIT — see [LICENSE](LICENSE) for details.
