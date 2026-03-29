# packages/ — Shared Packages

## Overview

Three packages provide shared code across the monorepo. None require a build step — they are consumed directly as TypeScript source via tsconfig path aliases and (for UI) Next.js `transpilePackages`.

---

## packages/ui — `@openworkspace/ui`

### Purpose
Shared headless UI component library built on [Base UI](https://base-ui.com) primitives and styled with Tailwind v4. Used by both `apps/app` and `apps/website`.

### Design decisions
- **No build step**: Next.js `transpilePackages: ['@openworkspace/ui']` compiles the TypeScript source directly.
- **No shadcn copy-paste**: components live in one place; apps import from the package.
- **`"use client"` directives**: components that use React hooks include the directive so they work in Next.js RSC environments.

### Components

| Export | File | Base UI primitive |
|--------|------|-------------------|
| `Avatar`, `AvatarImage`, `AvatarFallback` | `avatar.tsx` | `@base-ui/react/avatar` |
| `Badge` | `badge.tsx` | `div` + CVA variants |
| `Button`, `buttonVariants` | `button.tsx` | `@base-ui/react/button` + CVA |
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` | `card.tsx` | — |
| `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` | `dialog.tsx` | `@base-ui/react/dialog` |
| `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` | `dropdown-menu.tsx` | `@base-ui/react/menu` |
| `Input` | `input.tsx` | — |
| `Label` | `label.tsx` | — |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` | `select.tsx` | `@base-ui/react/select` |
| `Separator` | `separator.tsx` | — |
| `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` | `sheet.tsx` | `@base-ui/react/dialog` (variant) |
| `Skeleton` | `skeleton.tsx` | — |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `tabs.tsx` | `@base-ui/react/tabs` |
| `Textarea` | `textarea.tsx` | — |
| `cn` | `utils.ts` | `clsx` + `tailwind-merge` |

### Known Limitations

- **`Button asChild` is not supported** — Base UI's Button doesn't have an `asChild` prop like shadcn/Radix. Use `<Link className={buttonVariants(...)}>` for link-buttons instead.
- **`Select.onValueChange` returns `string | null`** — always add a `?? 'default'` fallback when the value drives a typed state.

### Usage

```typescript
import { Button, buttonVariants } from "@openworkspace/ui/button"
import { Card, CardContent } from "@openworkspace/ui/card"
import { cn } from "@openworkspace/ui/utils"
```

### tsconfig path aliases (consuming app)
```json
{
  "@openworkspace/ui": ["../../packages/ui/src/index.ts"],
  "@openworkspace/ui/*": ["../../packages/ui/src/*"]
}
```

### next.config.ts (consuming app)
```ts
transpilePackages: ['@openworkspace/ui']
```

---

## packages/api-types — `@openworkspace/api-types`

### Purpose
Hand-maintained TypeScript types for all API request and response shapes. Eliminates `Record<string, unknown>` casts throughout `apps/app/lib/api.ts` and provides IDE autocomplete for API consumers.

### Design decisions
- **Hand-maintained, not generated**: avoids a code-gen pipeline; types stay close to the actual NestJS service logic.
- **No build step**: consumed via tsconfig paths as raw TypeScript.
- **Source of truth**: when NestJS services change their return shape, these types must be updated to match.

### `src/models.ts` — Entity types

| Type | Description |
|------|-------------|
| `User` | `{id, email, name, avatarUrl?, createdAt}` |
| `Workspace` | `{id, slug, name, ownerId, createdAt, _count?: {members, projects}}` |
| `Project` | `{id, workspaceId, name, description, leaderId, plannerProjectAgentId?, _count?}` |
| `ResourceKey` | `{id, projectId, name, description?, createdAt, createdById}` |
| `WorkspaceProviderKey` | `{id, workspaceId, provider, createdAt}` |
| `AgentProvider` | `{id, userId, displayName, bio?, activeDpaVersion?, createdAt}` |
| `Agent` | `{id, name, type, description, pricingModel, capabilityTags, aggregateRating?, provider?, _count?}` |
| `ProjectAgent` | `{id, projectId, agentId, role, isCoordinator, hiredAt, revokedAt?, agent?, agreement?}` |
| `Task` | `{id, projectId, title, description, status, priority, assigneeId?, assignee?, dueDate?, activities?, _count?}` |
| `TaskComment` | `{id, taskId, authorId, authorType, content, createdAt}` |
| `AgentRunStep` | `{iteration, timestamp, llm_content?, tool_calls?, error?}` |
| `AgentRunLog` | `{id, taskId, agentId, status, iterations, log: AgentRunStep[], startedAt, finishedAt?}` |
| `BillingCycleSummary` | `{workspaceId, periodStart, periodEnd, totalCents, totalFormatted, byProject}` |
| `ProviderEarnings` | `{providerId, periodStart, periodEnd, totalCents, totalFormatted, records}` |
| `Paginated<T>` | `{data: T[], total, page, limit, totalPages}` |

### `src/requests.ts` — DTO types

| Type | Used by |
|------|---------|
| `CreateWorkspaceDto` | `workspacesApi.create` |
| `InviteMemberDto` | `workspacesApi.invite` |
| `CreateProjectDto` | `projectsApi.create` |
| `HireAgentDto` | `projectsApi.hireAgent` |
| `AcceptAgreementDto` | `projectsApi.acceptAgreement` |
| `CreateTaskDto` | `tasksApi.create` |
| `UpdateTaskDto` | `tasksApi.update` |
| `AddCommentDto` | `tasksApi.addComment` |
| `CreateAgentDto` | `agentsApi.createAgent` |
| `CreateProviderDto` | `agentsApi.registerProvider` |
| `AcceptDpaDto` | `agentsApi.acceptDpa` |
| `CreateResourceKeyDto` | `keysApi.create` |
| `UpsertWorkspaceKeyDto` | `workspaceKeysApi.upsert` |
| `RecordUsageDto` | `billingApi.recordUsage` |
| `CreateCheckoutDto` | `billingApi.createCheckout` |
| `SetPlannerDto` | `plannerApi.setPlanner` |
| `AcceptPlanDto` | `plannerApi.acceptPlan` |
| `MarketplaceSearchParams` | `marketplaceApi.search` |

---

## packages/shared — `@openworkspace/shared`

### Purpose
Base enums and lightweight interfaces shared between `apps/api` (NestJS) and `apps/app` (Next.js). Has a `tsc` build step (outputs to `dist/`).

### Exports

**Enums:**
- `AgentType`: `AI | HUMAN`
- `PricingModel`: `PER_TASK | PER_TOKEN | MONTHLY`
- `ProjectRole`: `LEADER | COORDINATOR | DEVELOPER | REVIEWER | DESIGNER | QA | CUSTOM`
- `WorkspaceMemberRole`: `OWNER | ADMIN | MEMBER`
- `TaskStatus`: `BACKLOG | TODO | IN_PROGRESS | BLOCKED | DONE`
- `TaskPriority`: `LOW | MEDIUM | HIGH | URGENT`
- `LlmProvider`: `openai | anthropic | gemini`

**Interfaces:**
- `Project`, `ResourceKey` — base shapes without DB-specific fields
- `Workspace`, `WorkspaceMember`, `User`
- `Agent`, `AgentProvider`
- `MarketplaceFilters`, `PaginatedResult<T>`

> Note: `@openworkspace/api-types` is more detailed and specific to the actual API responses. `@openworkspace/shared` provides the lower-level enum and base interface definitions that both packages reference.
