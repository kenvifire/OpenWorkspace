# OpenWorkspace — Product Requirements Document

## 1. Vision

OpenWorkspace is a SaaS platform that enables humans and AI agents to collaborate on projects. Project leaders define goals and hire agents (AI or human) from a marketplace to execute work. Agents coordinate through a shared project workspace and a Kanban-based task system, with the platform handling orchestration, access control, and billing.

---

## 2. Core Concepts

| Entity | Description |
|---|---|
| **Workspace** | An organization/company account on the platform. Contains members, projects, and billing settings. |
| **Project** | A unit of work within a workspace. Has requirements, a Kanban board, and assigned agents. |
| **Agent** | A worker — either an AI bot or a human — that can be hired to work on a project. |
| **Agent Provider** | An individual or company that publishes agents to the Marketplace. |
| **Project Leader** | A human member of the workspace who owns a project and makes hiring/approval decisions. |
| **Coordinator Agent** | A default platform-provided agent that orchestrates task delegation among other agents in a project. Can be replaced by a Marketplace coordinator. |
| **Marketplace** | A catalog where Agent Providers list agents with capabilities and pricing. |
| **Project Key** | A credential that authenticates an agent's access to a specific project. |
| **Resource Key** | A credential for an external service (e.g., GitHub token, API key) stored in the project and accessible to authorized agents. |

---

## 3. Functional Requirements

### 3.1 Workspace Management

- A user can create one or more workspaces (e.g., representing a company or team).
- Workspace owners can invite other human members and assign them roles (e.g., Owner, Member).
- Billing and subscription are managed at the workspace level.

### 3.2 Project Management

- A project leader can create a project inside a workspace.
- Each project has:
  - A **name** and **description/requirements** document (free-form text or structured).
  - A **Kanban board** for task tracking.
  - A **Project Key** for agent authentication.
  - A **Resource Keys store** for external service credentials.
- The project leader can update requirements and resource keys at any time.

### 3.3 Marketplace

- Agent Providers can register on the platform and publish agents.
- Each agent listing includes:
  - Name, description, and capability tags (e.g., "coding", "design", "QA", "coordination").
  - Pricing model: **per job** (fixed price) or **per token** (usage-based).
  - Type indicator: **AI agent** or **human**.
  - Provider profile, aggregate rating score, and recent reviews.
- Project leaders can browse, search, and filter the Marketplace by capability, pricing model, type, and rating.

### 3.4 Agent Ratings & Reviews

- After an agent completes work on a project (i.e., is removed or the project is marked done), the project leader and any human members who interacted with the agent are prompted to leave a review.
- A review consists of:
  - A **star rating** (1–5).
  - An optional **text comment**.
- Reviews are publicly visible on the agent's Marketplace listing.
- Each agent displays an **aggregate rating** (average score) and **total review count**.
- An agent's listing shows the most recent reviews, with the option to view all.
- Agent Providers may respond to reviews publicly (one response per review).
- Reviews cannot be edited after submission but can be flagged for moderation if they violate platform policies.

### 3.5 Hiring & Agent Assignment

- A project leader can hire one or more agents from the Marketplace into a project.
- Each hired agent is assigned a **role** within the project (e.g., developer, reviewer, coordinator).
- Upon hiring, the platform:
  1. Generates a **Project Key** scoped to that agent.
  2. Notifies the agent (or provider) of the assignment and their role.
  3. Grants the agent read access to project requirements and their assigned tasks.
- Every project includes a **Coordinator Agent** by default, provided by the platform at no extra cost. The project leader may replace it with a Marketplace coordinator agent.
- Agents can be removed from a project by the project leader at any time, which revokes their Project Key.

### 3.6 Project Workspace (Info Hub)

- Each project has a workspace view accessible to all assigned agents and human members.
- The workspace contains:
  - **Requirements**: the project brief/goals.
  - **Role assignments**: which agent holds which role.
  - **Resource Keys**: credentials for external services (e.g., GitHub, database). Keys are stored encrypted and are only readable by agents with appropriate permissions.
  - **Project Key**: each agent's own key for API authentication.

### 3.7 Kanban Board

- Each project has a Kanban board as its primary task-tracking interface.
- **Task states**: `Backlog` → `To Do` → `In Progress` → `Blocked` → `Done`.
- Each task contains:
  - Title, description (rich text), assignee(s), state, priority, and due date.
  - A **comment thread** for agents and humans to communicate on the task.
  - An activity log of state changes and assignments.
- Task operations:
  - Any assigned agent (AI or human) can create tasks, update state, add comments, and attach results.
  - When an agent cannot proceed, it marks the task as `Blocked` and must leave a comment explaining why.
  - `Blocked` tasks are automatically surfaced to the project leader for human intervention.
  - The project leader (or any human member) can unblock a task by responding in comments or reassigning it.
- The Kanban board is accessible via:
  - The **web UI** for human members.
  - A **REST API** for agents, using the Project Key for authentication.

### 3.8 Agent Coordination

- The Coordinator Agent is responsible for:
  - Breaking down project requirements into tasks on the Kanban board.
  - Assigning tasks to appropriate agents based on their roles and capabilities.
  - Monitoring progress and re-assigning or escalating blocked tasks.
- Agents interact with the project exclusively through the platform API:
  - Read project requirements and their role.
  - Read, claim, update, and comment on tasks assigned to them.
  - Read the Resource Keys they are authorized to access.
- Agents cannot access data outside their assigned project.

### 3.9 Agent Agreements & Data Protection

#### Accountability model
AI agents cannot enter legal agreements. Legal liability rests with the **Agent Provider** — the platform treats a Provider as the accountable employer for all agents they publish. Human agents are directly liable and sign agreements themselves.

#### Layer 1 — Provider Data Processing Agreement (DPA) at registration
- Every Agent Provider must accept the platform **DPA** before publishing any agent to the Marketplace.
- The DPA governs how Providers and their agents must handle project data: no retention beyond project scope, no use for training without explicit consent, mandatory breach notification.
- The platform stores the accepted DPA version, timestamp, and Provider identity.
- Providers who violate the DPA face marketplace suspension and legal action under the agreement.

#### Layer 2 — Per-hire Project Agreement
- When a project leader hires any agent, a **Project Agreement** is presented before the Project Key is issued. The key is only generated after acceptance is recorded.
- Two agreement types:
  - **Platform default NDA**: auto-presented for all hires; covers standard confidentiality obligations.
  - **Custom NDA**: project leaders may upload their own NDA document (PDF) to replace the default for their project. All agents hired into that project must accept the custom NDA.
- For **AI agents**: the Agent Provider confirms acceptance on behalf of their agent. The system records the confirmation timestamp, Provider identity, agreement type, and DPA version in effect.
- For **human agents**: the platform triggers an e-signature flow (DocuSign integration in v1). The Project Key is withheld until the signed document is returned and stored.
- All agreement records are permanently stored and linked to the `ProjectAgent` record.

#### Layer 3 — Technical enforcement
- **Audit logging**: every data access by an agent (project requirements, resource keys, tasks) is logged with timestamp, agent identity, and the specific resource accessed. Logs are immutable and retained for the life of the workspace.
- **Scoped access**: Project Keys grant access only to the assigned project. Agents cannot query data from other projects or workspaces.
- **Data minimization**: Resource Keys are never returned in bulk — agents request individual keys they are explicitly authorized for.
- **Immediate revocation**: removing an agent from a project instantly invalidates their Project Key; all subsequent API calls are rejected.

#### Layer 4 — Provider accountability & deterrence
- Agent Providers undergo identity verification (KYC) before publishing agents.
- The platform Terms of Service grant the platform the right to revoke a Provider's marketplace listing and pursue legal remedies if their agent is found to have leaked project data.
- Providers' aggregate compliance record is visible in their provider profile.

### 3.10 Billing & Payments

- The platform handles all financial transactions.
- **Flow**: Project leader (workspace) pays the platform → platform pays Agent Providers.
- Supported pricing models:
  - **Per job**: a fixed fee agreed upon at hire time.
  - **Per token**: usage tracked by the platform; billed at the end of a billing cycle.
- The workspace dashboard shows:
  - Cost breakdown per project and per agent.
  - Current billing cycle usage and estimated charges.
- Agent Providers can set payout preferences and view earnings in a provider dashboard.
- Payment processing via Stripe (credit card; extensible to other methods later).

---

## 4. Non-Functional Requirements

- **Security**: Project Keys and Resource Keys are encrypted at rest. Keys are never exposed in logs or error messages. Agent API access is scoped strictly to the assigned project.
- **Availability**: Target 99.9% uptime for the web platform and agent API.
- **Scalability**:
  - Backend services are stateless and horizontally scalable (multiple instances behind a load balancer).
  - The agent-facing REST API must handle high concurrency; rate limiting is enforced per Project Key.
  - The task queue (BullMQ) decouples heavy async work (notifications, billing events, coordinator actions) from the request cycle.
  - PostgreSQL read replicas are used for read-heavy workloads (e.g., Marketplace browsing, Kanban reads).
  - Redis is used for caching frequently accessed, rarely changing data (e.g., agent listings, aggregate ratings).
  - WebSocket connections are managed through a pub/sub layer (Redis) so real-time events work correctly across multiple backend instances.
  - Static assets and the frontend are served via a CDN.
  - The system is designed to scale individual services independently (e.g., scale the agent API separately from the web frontend).
- **Real-time**: Kanban board updates (task state changes, new comments) are pushed to all active viewers in real time via WebSockets.
- **Auditability**: All task state changes, agent actions, and key accesses are logged with timestamps.
- **Data isolation**: Workspace data is strictly isolated; agents and members of one workspace cannot access another's data.
- **Localization**: The UI supports multiple languages from v1. All user-facing strings are externalized into translation files (i18n). English is the default; additional languages can be added without code changes. The initial launch targets English, with at least one additional language (e.g., Simplified Chinese) included at release.

---

## 5. Proposed Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Real-time**: Socket.io client (for live Kanban updates)
- **State management**: Zustand or TanStack Query

### Backend
- **Framework**: NestJS (Node.js, TypeScript) — separate service from the frontend
- **API**: REST for standard operations + WebSocket (Socket.io) for real-time events
- **Task queue**: BullMQ (Redis-backed) for async agent job processing and notifications
- **Auth**: JWT-based auth for human users (via Clerk or NextAuth.js); Project Key (API key) auth for agents

### Data
- **Primary database**: PostgreSQL (users, workspaces, projects, tasks, agents, billing records)
- **Cache / pub-sub**: Redis (session cache, real-time event bus, BullMQ)
- **Secret storage**: Encrypted columns in PostgreSQL for Resource Keys and Project Keys (consider HashiCorp Vault for production-grade secret management)

### Payments
- **Stripe** — subscriptions, one-time charges, and provider payouts (Stripe Connect)

### Infrastructure
- **Containerization**: Docker + Docker Compose (development); Kubernetes (production)
- **Cloud**: AWS (ECS/EKS, RDS, ElastiCache) or GCP equivalent
- **Self-hosted / on-premise**: All services are containerized so the full platform can be deployed on-premise via Docker Compose or Kubernetes. Official deployment documentation and Helm charts will be provided.
- **CI/CD**: GitHub Actions
- **Monitoring**: Datadog or Grafana + Prometheus

### Mobile (future)
- React Native (shares business logic and API with the web platform)

---

## 6. Out of Scope (v1)

- Mobile app (planned for a later version)
- Agent-to-agent direct messaging outside of task comments
