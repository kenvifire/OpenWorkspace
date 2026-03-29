# apps/runner — Python Agent Runner

## Overview

The runner is a standalone Python asyncio service that consumes agent job messages from a Redis Stream, runs an agentic LLM loop against each job, and writes results directly to PostgreSQL. It has no HTTP server — it communicates inbound via Redis Streams and outbound via Redis pub/sub.

- **Language**: Python 3.11+
- **Runtime**: asyncio + uvloop
- **Entry point**: `python -m src.main`
- **Key dependencies**: `asyncpg`, `redis[asyncio]`, `httpx`, `cryptography`, `cuid2`

---

## Architecture

```
Redis Stream: agent-runs
       │
       │ XREADGROUP (consumer group: runner-group)
       │
  ┌────▼──────────────────────────────────────────┐
  │              processor.py                     │
  │                                               │
  │  ┌──────────────┐    ┌────────────────────┐   │
  │  │  _read_loop  │    │   _claim_loop      │   │
  │  │  (XREADGROUP)│    │  (every 60s,       │   │
  │  │  blocking 5s │    │   reclaim idle >30s│   │
  │  └──────┬───────┘    └────────────────────┘   │
  │         │                                     │
  │  ┌──────▼───────────────────────────────────┐ │
  │  │  _process_job()                          │ │
  │  │                                          │ │
  │  │  1. Load agent config from Postgres      │ │
  │  │  2. Resolve API key                      │ │
  │  │  3. Load task title + description        │ │
  │  │  4. Agentic loop (up to maxIterations):  │ │
  │  │     a. Poll AgentRunLog.status (STOPPED?)│ │
  │  │     b. call_llm() → response             │ │
  │  │     c. execute_tool() for each tool call │ │
  │  │     d. complete_task → break             │ │
  │  │  5. _save_run_log() to Postgres          │ │
  │  │  6. XACK                                 │ │
  │  └──────────────────────────────────────────┘ │
  └───────────────────────────────────────────────┘
       │ asyncpg writes
       ▼
  PostgreSQL                    Redis pub/sub: kanban:events
  (Task, TaskComment,  ─────►  (task:updated, comment:created, ...)
   TaskActivity,
   AgentRunLog)
```

---

## Source Files

### `src/config.py`
Loads `.env` (via `python-dotenv`) and exposes typed constants:
- `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `ENCRYPTION_SECRET`
- `STREAM_NAME = "agent-runs"`, `CONSUMER_GROUP = "runner-group"`, `CONSUMER_NAME` (from `RUNNER_INSTANCE` env)

### `src/main.py`
Asyncio entry point:
1. Installs uvloop event loop policy if available.
2. Wires up `SIGINT`/`SIGTERM` handlers to an `asyncio.Event`.
3. Starts `run_consumer()` as a task.
4. On shutdown: cancels the consumer task, closes the asyncpg pool, closes the Redis pub/sub client.

### `src/database.py`
Lazy asyncpg connection pool singleton (`_pool`). `get_pool()` creates it on first call with `min_size=2, max_size=10`. `close_pool()` called on graceful shutdown.

### `src/encryption.py`
AES-256-GCM decryption matching NestJS `EncryptionService`:
- Key = `SHA-256(ENCRYPTION_SECRET.encode())` — 32 bytes
- Ciphertext format: `iv_hex:tag_hex:ciphertext_hex` (colon-separated)
- Uses Python `cryptography` library `AESGCM`

### `src/events.py`
Thin wrapper around `redis.asyncio` pub/sub. `publish(event, payload)` serialises `{event, payload}` as JSON and sends to the `kanban:events` channel. Shares a single lazy Redis client; `close()` called on shutdown.

### `src/llm.py`
Unified LLM caller returning a normalised dict:
```python
{
  "content": str | None,       # text content from LLM
  "tool_calls": [              # list of tool calls requested
    {"id": str, "name": str, "arguments": dict}
  ],
  "stop_reason": "tool_use" | "end_turn"
}
```
Provider routing:
| Provider | Endpoint | Tool format |
|----------|----------|-------------|
| `openai` | `https://api.openai.com/v1/chat/completions` | OpenAI function-calling (`tools: [{type: "function", ...}]`) |
| `anthropic` | `https://api.anthropic.com/v1/messages` | Anthropic tools (`input_schema`) |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Gemini `functionDeclarations` |

All calls are made via `httpx.AsyncClient` with a 120 s timeout.

### `src/tools.py`
Defines 7 MCP tools and their implementations:

| Tool | Description | DB writes |
|------|-------------|-----------|
| `get_task` | Fetch task by ID | — |
| `update_task` | Update title / description / status / priority | `Task`, `TaskActivity` |
| `create_task` | Create new task in project | `Task` |
| `get_project_tasks` | List all tasks in the project | — |
| `add_comment` | Post a comment (visible to humans) | `TaskComment` |
| `get_resource_key` | Decrypt and return a named resource key | `AuditLog` |
| `complete_task` | Mark task DONE + post summary comment | `Task`, `TaskComment`, `TaskActivity` |

All writes go directly to Postgres via asyncpg (bypassing the NestJS API). After mutating tasks or posting comments, the tool publishes an event to `kanban:events` so the frontend receives the update in real time.

`get_enabled_tools(enabled_tool_names)` filters `ALL_TOOLS` to the agent's configured subset (empty = all tools enabled).

### `src/processor.py`
Core consumer logic:

**`run_consumer()`**
- Creates `XGROUP CREATE … MKSTREAM` (idempotent — ignores `BUSYGROUP` error).
- Launches `_claim_loop` as a background task.
- Runs `_read_loop` until cancelled.

**`_read_loop()`**
- `XREADGROUP GROUP runner-group {CONSUMER_NAME} STREAMS agent-runs > COUNT 1 BLOCK 5000`
- On message: calls `_process_job()`, then `XACK` on success. On exception: leaves unACKed for retry.

**`_claim_loop()`**
- Runs every 60 s.
- Uses `XPENDING_RANGE` to find messages idle > 30 s, then `XCLAIM`s them to this consumer.
- Handles crashed runner instances — their unACKed messages are reassigned automatically.

**`_process_job(job)`**
1. Extract `taskId`, `agentId`, `projectAgentId`, `projectId`, `workspaceId`, `runLogId`.
2. `SELECT` agent config from `Agent` table (llmProvider, modelName, systemPrompt, encryptedApiKey, temperature, maxTokens, maxIterations, enabledTools).
3. Resolve API key: agent-level `encryptedApiKey` → workspace `WorkspaceProviderKey` → raise.
4. Load task title and description.
5. Build initial user message: `"You have been assigned a task: {title}\n\n{description}"`.
6. Agentic loop (up to `maxIterations`, default 20):
   - Poll `AgentRunLog.status` — exit if `STOPPED`.
   - Call LLM with current message history + tools.
   - Execute each tool call, append result to history.
   - If `complete_task` is called → finalise immediately.
   - If no tool calls → LLM is done.
   - Every 5 iterations: flush log to `AgentRunLog.log` (JSONB).
7. On loop end (or exception), call `_save_run_log()` with final status and step array.

**Step log format** (`AgentRunLog.log`):
```json
[
  {
    "iteration": 1,
    "timestamp": "2026-03-09T10:00:00Z",
    "llm_content": "I'll start by checking the task details...",
    "tool_calls": [
      {
        "name": "get_task",
        "arguments": {"task_id": "abc123"},
        "result": "{\"id\": \"abc123\", \"title\": \"...\"}"
      }
    ]
  }
]
```

**Message history construction**: uses Anthropic-style multi-block content (text + tool_use blocks for assistant messages, tool_result blocks for user messages). This format is also parseable by OpenAI and Gemini with minor normalisation inside `llm.py`.

---

## API Key Resolution

```
Agent.encryptedApiKey set?
  ├── YES → decrypt(Agent.encryptedApiKey)
  └── NO  → look up WorkspaceProviderKey for (workspaceId, agent.llmProvider)
              ├── found → decrypt(WorkspaceProviderKey.encryptedKey)
              └── not found → ValueError (job fails)
```

---

## Run Log Statuses

| Status | When |
|--------|------|
| `RUNNING` | Created by API on enqueue; runner is processing |
| `COMPLETED` | Tool `complete_task` called, or LLM returned with no tool calls |
| `STOPPED` | API set status to STOPPED; runner polled and exited |
| `FAILED` | Unhandled exception in `_process_job` |
| `MAX_ITERATIONS` | Loop exhausted `maxIterations` without completing |

---

## Graceful Shutdown

```
SIGINT / SIGTERM
  → stop_event.set()
  → consumer_task.cancel()
  → await consumer_task  (CancelledError caught)
  → close asyncpg pool
  → close Redis client
```

In-flight jobs are left unACKed in the stream's PEL. The claim loop in the next runner startup will reclaim them after 30 s.

---

## Horizontal Scaling

Multiple runner instances can run simultaneously. Each must have a unique `RUNNER_INSTANCE` env var (the Redis consumer name). They share the `runner-group` consumer group, so Redis distributes each stream message to exactly one instance.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_HOST` | Yes | Redis hostname |
| `REDIS_PORT` | No | Redis port (default 6379) |
| `ENCRYPTION_SECRET` | Yes | Must match `apps/api` ENCRYPTION_SECRET |
| `RUNNER_INSTANCE` | No | Consumer name (default `runner-1`) |
