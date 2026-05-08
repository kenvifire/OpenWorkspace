# Coordinator Agent Design

## Goal

Add an optional AI coordinator agent to each project that gates task execution at every significant board event — deciding whether to proceed, hold, escalate to a human, or abort — instead of relying on hard-coded automatic flows.

## Context

Currently `tasks.service.ts` auto-triggers agents and unblocks dependents via `maybeEnqueueAgent` and `maybeUnblockDependents`. These rules are deterministic and cheap, but cannot handle complex sequencing, shifting priorities, or novel situations. The coordinator replaces these rules for projects that need intelligent gating, while leaving all other projects unchanged.

---

## Architecture

### Principle

Projects without a coordinator behave exactly as today. Projects with a coordinator assigned have all automatic flows bypassed; the coordinator makes every gating decision.

### Components

| Component | Location | Responsibility |
|---|---|---|
| Coordinator agent config | `Agent` record (`isCoordinator=true` on `ProjectAgent`) | LLM model, system prompt, tool config |
| Trigger publisher | `tasks.service.ts` | Publishes to `coordinator-events` stream on significant transitions |
| `coordinator-events` stream | Redis | Decoupled queue; coordinator never blocks task queue |
| `_coordinator_loop()` | `apps/runner/src/processor.py` | Second asyncio consumer; reads `coordinator-events` |
| `_process_coordinator_event()` | `apps/runner/src/processor.py` | Loads coordinator agent, runs LLM decision loop |
| Coordinator tools | `apps/runner/src/tools.py` | Five tools: `get_board_state`, `proceed`, `hold`, `escalate`, `abort` |

---

## Data Model

### Schema changes

```prisma
// Project — one new nullable FK
coordinatorProjectAgentId String?
coordinator ProjectAgent? @relation("ProjectCoordinator", fields: [coordinatorProjectAgentId], references: [id])

// ProjectAgent — inverse relation
coordinatorForProjects Project[] @relation("ProjectCoordinator")
```

One migration. No new tables. Coordinator decisions are logged as `AgentRunLog` entries (reusing existing infrastructure) and `TaskComment` entries on affected tasks.

### Assignment

The project settings page gets a "Coordinator" section. A coordinator is hired and assigned exactly like a planner agent. One coordinator per project maximum.

---

## Trigger Events

`tasks.service.ts` calls `maybeNotifyCoordinator(projectId, taskId, event)` in place of the existing auto-flows when a project has a coordinator assigned.

| `triggerEvent` | When published |
|---|---|
| `TASK_DONE` | Any task moves to DONE |
| `TASK_BLOCKED` | An AI task sets itself to BLOCKED |
| `TASK_FAILED` | A run ends in FAILED status |
| `HUMAN_DONE` | A human-assigned task moves to DONE |

Message shape pushed to `coordinator-events`:

```json
{
  "projectId": "...",
  "triggerTaskId": "...",
  "triggerEvent": "TASK_DONE",
  "coordinatorProjectAgentId": "..."
}
```

The existing `maybeEnqueueAgent` and `maybeUnblockDependents` are skipped when a coordinator is assigned. They continue to run unchanged for projects without a coordinator.

---

## Coordinator Runner Loop

`processor.py` spawns a second asyncio task on startup: `_coordinator_loop()`.

- Reads from stream `coordinator-events`, consumer group `coordinator-group`
- Shares the existing DB pool, encryption, and LLM infrastructure with the task loop
- Processes one event at a time (coordinator decisions are cheap; no need for parallelism)
- ACKs the message after the decision is executed
- On failure, leaves the message unACKed for retry (same pattern as task jobs)

`_process_coordinator_event(job)` flow:
1. Load coordinator `Agent` config (LLM provider, model, system prompt, tools)
2. Resolve API key (same `_resolve_api_key` as task agents)
3. Run the LLM decision loop with the five coordinator tools
4. Create an `AgentRunLog` entry (status RUNNING → COMPLETED/FAILED)

The coordinator loop does not use sandboxes (E2B). It has no `maxIterations` concern — decisions complete in 2–3 tool calls.

---

## Coordinator Tools

The coordinator has exactly five tools. No sandbox, code execution, or resource key access.

### `get_board_state`

Returns full project context: all tasks with status, assignee (human/AI, name), dependency edges, last run result, and last 3 comments. Also returns a `ready_tasks` list — unblocked AI-assigned tasks not currently running. Called first in every coordinator run.

### `proceed(task_ids: string[])`

Enqueues the listed tasks for execution. Task IDs must refer to tasks with AI assignees. Forces the coordinator to explicitly name what to start; does not auto-start everything ready. Sets task status to TODO and pushes to `agent-runs` stream.

### `hold(reason: string)`

No-op with logged reason. Posts `reason` as a comment on the triggering task. Use when the coordinator wants to wait without creating a formal human task. Returns STOP.

### `escalate(title, description, assignee_user_id, priority)`

Creates a human-assigned TODO task at the project level. Not tied to blocking any specific AI task — that is a separate concern. Can be combined with `proceed` or `hold` in the same run (e.g. start two tasks AND ask a human about the budget). Uses `_ensure_human_project_agent` to resolve the assignee, same as `request_human_input`.

### `abort(reason: string)`

Marks all TODO and IN_PROGRESS tasks as BLOCKED. Posts `reason` as a comment on each affected task. Stops all work on the project. Returns STOP. Reversible only by manual human intervention on the board.

---

## Coordinator System Prompt (default)

```
You are the project coordinator. Your job is to decide what happens next after a significant board event.

Rules:
1. Always call get_board_state first.
2. Make exactly one primary decision: proceed, hold, escalate, or abort.
3. You may combine escalate with proceed or hold in the same run.
4. Be concise. State your reasoning in one sentence before acting.
5. When in doubt, hold and escalate rather than proceeding blind.
```

---

## UI Changes

### Project Settings page

Add a "Coordinator" section below the existing "Planner" section:
- Shows currently assigned coordinator (name, model) or "None assigned"
- "Assign Coordinator" button opens the hire-agent flow filtered to AI agents
- "Remove Coordinator" unsets `coordinatorProjectAgentId`

### Board page

No changes to the board UI. Coordinator decisions appear as task comments (existing comment UI) and run logs (existing Logs tab in TaskDetail).

---

## Error Handling

- If `coordinator-events` message has an invalid `coordinatorProjectAgentId`, ACK and log error — do not retry infinitely.
- If the coordinator LLM call fails, mark `AgentRunLog` as FAILED and leave the message unACKed for retry.
- If the coordinator calls `proceed` with invalid task IDs, return a tool error and let the LLM retry with corrected IDs.
- If no coordinator run is triggered within 5 minutes of an event (e.g. runner is down), the message stays pending and is claimed on restart.

---

## What Is Not In Scope

- Coordinator modifying task content (title, description, assignee) — gating only
- Multiple coordinators per project
- Coordinator triggering other coordinators
- Real-time coordinator status in the board UI (beyond existing comments/run logs)
- Automatic coordinator assignment at project creation
