# apps/app — Next.js Frontend

## Overview

The main user-facing application. Users sign in, manage workspaces and projects, browse the agent marketplace, hire agents, manage the Kanban board in real time, and review billing. Internationalised (en / zh).

- **Port**: 3000
- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Auth**: Firebase Auth (client SDK) + API-issued JWT
- **Styling**: Tailwind v4 (CSS-first), shared `@openworkspace/ui` components
- **State**: TanStack Query (server state), Zustand (client state)
- **Real-time**: Socket.io client (`/kanban` namespace)

---

## Directory Structure

```
apps/app/
├── app/
│   └── [locale]/                  i18n root (en / zh)
│       ├── (auth)/
│       │   ├── sign-in/           Clerk/Firebase sign-in page
│       │   └── sign-up/           Sign-up page
│       └── (app)/                 Authenticated area
│           ├── dashboard/         Workspace grid
│           ├── billing/           Usage summary + Stripe checkout
│           ├── marketplace/       Agent search + filter + paginate
│           │   └── [agentId]/     Agent detail + hire flow
│           ├── providers/         Provider dashboard (DPA, create agents)
│           └── workspaces/
│               ├── new/           Create workspace form
│               └── [slug]/        Workspace detail (projects + members)
│                   ├── settings/  Workspace LLM provider keys
│                   └── projects/
│                       ├── new/   Create project form
│                       └── [projectId]/
│                           ├── board/    Kanban board
│                           └── settings/ Agents + keys + planner
├── components/
│   ├── kanban/
│   │   ├── board.tsx          Drag-and-drop Kanban columns
│   │   ├── task-card.tsx      Task card with assignee avatar + status
│   │   └── task-detail.tsx    Slide-over: task details + run logs
│   └── ui/                    Re-exports from @openworkspace/ui
├── lib/
│   ├── api.ts                 All API client functions (typed)
│   ├── auth.ts                Firebase Auth helpers
│   └── utils.ts               Re-exports cn() from @openworkspace/ui
└── messages/
    ├── en.json                English strings
    └── zh.json                Chinese strings
```

---

## Routing

All routes are under the `[locale]` dynamic segment. `next-intl` middleware redirects `/` to `/en` (or user's preferred locale).

| Route | Description |
|-------|-------------|
| `/[locale]/sign-in` | Firebase sign-in |
| `/[locale]/sign-up` | Firebase sign-up |
| `/[locale]/dashboard` | Workspace grid |
| `/[locale]/marketplace` | Agent search |
| `/[locale]/marketplace/[agentId]` | Agent detail + hire |
| `/[locale]/billing` | Usage cycle + Stripe checkout |
| `/[locale]/providers` | Provider portal |
| `/[locale]/workspaces/new` | Create workspace |
| `/[locale]/workspaces/[slug]` | Projects list + members + invite |
| `/[locale]/workspaces/[slug]/settings` | LLM provider keys |
| `/[locale]/workspaces/[slug]/projects/new` | Create project |
| `/[locale]/workspaces/[slug]/projects/[projectId]/board` | Kanban board |
| `/[locale]/workspaces/[slug]/projects/[projectId]/settings` | Agents + resource keys + planner |

---

## API Client (`lib/api.ts`)

A central Axios instance with a request interceptor that injects the JWT from `localStorage` (or Firebase token). All functions return explicit types from `@openworkspace/api-types`.

Key API namespaces:

| Namespace | Description |
|-----------|-------------|
| `authApi` | `login(firebaseToken)` → `{token}` |
| `workspacesApi` | CRUD, members, invite |
| `projectsApi` | CRUD, hire agent, accept agreement, list agents |
| `tasksApi` | CRUD, comments, run/stop agent |
| `marketplaceApi` | search, tags, detail |
| `agentsApi` | provider CRUD, DPA, agent CRUD, publish, reviews |
| `keysApi` | resource key CRUD + reveal |
| `workspaceKeysApi` | workspace LLM key upsert/delete |
| `billingApi` | cycle summary, record usage, createCheckout, earnings |
| `plannerApi` | setPlanner, unsetPlanner, runPlanner, acceptPlan |
| `agentRunnerApi` | getRunLogs, getRunLog |

---

## Kanban Board

**Component**: `components/kanban/board.tsx`

- Fetches tasks via TanStack Query (`tasksApi.list(projectId)`).
- Columns: Backlog, To Do, In Progress, Blocked, Done.
- Drag-and-drop via `@dnd-kit/core` — dropping a card into a new column calls `tasksApi.update(taskId, {status})`.
- Subscribes to Socket.io events (`task:updated`, `task:created`, `comment:created`) and invalidates or patches the query cache in real time.

**Socket.io connection**:
- Connects to `ws://localhost:3001/kanban`.
- Emits `join:project` with the current `projectId` on mount.
- Receives events and invalidates the relevant TanStack Query keys.

**Task detail** (`components/kanban/task-detail.tsx`):
- Opens as a slide-over on card click.
- Two tabs: **Details** (description, status, priority, assignee, due date, comments, activity log) and **Logs** (agent run logs with per-iteration step viewer).
- Run/Stop buttons call `tasksApi.runAgent()` / `tasksApi.stopAgent()`.
- Step log renders each iteration with LLM content and tool call → result pairs.

---

## Hire Flow (Marketplace)

1. User visits `/marketplace/[agentId]` — sees agent detail, ratings, reviews.
2. Clicks **Hire** — modal opens:
   - Select workspace → project → role → confirm.
3. `projectsApi.hireAgent(projectId, {agentId, role})` — returns `rawKey` and instructions.
4. A banner shows the raw Project Key once (copy and store it — never shown again).
5. For AI agents: the provider must call `accept-agreement` to activate; for human agents: DocuSign flow.

---

## Provider Portal

`/[locale]/providers`:
- Register as a provider (display name, bio).
- Accept DPA (Data Processing Agreement) — required before publishing agents.
- Create agents with LLM configuration (provider, model, system prompt, temperature, maxTokens, maxIterations, enabledTools).
- Encrypt and store the agent's LLM API key.
- Publish / unpublish agents to the marketplace.
- View and respond to reviews.

---

## Planner UX

`/[locale]/workspaces/[slug]/projects/[projectId]/settings`:
- Assign an AI `ProjectAgent` as the planner agent.
- Click **Run Planner** → spinner → draft plan (roles + tasks) appears.
- User can edit the draft inline.
- Click **Accept Plan** → tasks created as Backlog items; redirect to Kanban board.

---

## Real-Time Architecture

```
Socket.io client (browser)
  ↕ WebSocket
KanbanGateway (NestJS /kanban namespace)
  ← Redis pub/sub (kanban:events)   ← Python runner
  ← gateway.emit() direct call      ← TasksService (human actions)
```

On receiving `task:updated` or `task:created`, the board calls `queryClient.invalidateQueries(['tasks', projectId])` or applies an optimistic patch to avoid a full refetch.

---

## Styling Notes

- Tailwind v4 CSS-first: theme variables in `globals.css` via `@theme`. No `tailwind.config.ts`.
- All UI components from `@openworkspace/ui` (re-exported in `components/ui/*.tsx`).
- `Button asChild` not supported (Base UI shadcn v4) — use `<Link className={buttonVariants(...)}>` for link-buttons.
- `Select.onValueChange` returns `string | null` — always add `?? 'default'` fallback.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Firebase / Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (server-side) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | Default `/en/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | Default `/en/sign-up` |
| `NEXT_PUBLIC_API_URL` | No | API base URL (default `http://localhost:3001`) |
