# Agent System Requirements

## 1. Agent Model

### Basic Config (required)
- LLM provider: `openai` | `anthropic` | `gemini` | `custom`
- Model name (e.g. `gpt-4o`, `claude-sonnet-4-6`)
- System prompt

### Advanced Config (optional)
- Temperature (0–2, default 0.7)
- Max tokens (default provider max)
- Max iterations per run (default 20, user-configurable per agent)
- Enabled MCP tools (subset — restrict what the agent can access)

### API Keys
- User configures **global API keys per provider** in workspace/account settings (stored encrypted)
- Each agent can **override** the global key with its own key (also encrypted)
- At runtime: agent key takes priority; falls back to global provider key

### Visibility
- Private by default (only accessible within the owner's workspaces)
- Owner can publish to marketplace (existing publish/unpublish flow)

---

## 2. Planner Agent

A special agent role assigned to a project to bootstrap roles and tasks.

### Flow
1. User creates a project with name + description/context
2. User assigns a Planner agent (any agent can act as planner)
3. User triggers the planner (or it auto-runs on project creation if a planner is set)
4. Planner receives project context and outputs **structured JSON**:
   ```json
   {
     "roles": [
       { "name": "Backend Developer", "description": "Builds REST APIs and DB schema" },
       { "name": "QA Engineer", "description": "Writes and runs tests" }
     ],
     "tasks": [
       { "title": "Set up database schema", "role": "Backend Developer", "priority": "HIGH", "description": "..." },
       { "title": "Write API integration tests", "role": "QA Engineer", "priority": "MEDIUM", "description": "..." }
     ]
   }
   ```
5. Platform parses the JSON and:
   - Creates roles on the project (all as `CUSTOM` with the planner's role name string)
   - Adds all tasks to the Kanban board (status: `BACKLOG`)
6. User sees proposed roles and tasks inline — can edit titles/descriptions or remove items, then clicks "Accept" to commit
7. User hires/creates an agent for each role
8. Once roles are filled, project is ready to run

---

## 3. Task Assignment & Execution Trigger

- Planner assigns tasks to roles; roles are filled by agents
- Agent is triggered automatically (via BullMQ) when:
  - A task is assigned to a role that has an agent, **and** task status is `TODO`
  - OR user manually clicks "Run" on a task/agent
- Multiple agents run **in parallel** (one BullMQ job per agent task, no serial gate)
- User can **stop** a running agent job at any time

---

## 4. Agentic Loop (Platform-Run)

Executed server-side by a BullMQ worker:

```
1. Load task details + project context + conversation history
2. Build prompt: system prompt + task info + available tool definitions
3. Call LLM (provider/model from agent config, API key resolved per §1)
4. LLM returns: text response + optional tool calls
5. Execute tool calls → append results to conversation
6. Repeat from step 3 until:
   a. LLM calls `complete_task` (signals done)
   b. LLM returns no tool calls and no pending work
   c. Max iterations reached (agent config, default 20)
   d. User stops the job
7. Post final summary as a task comment
8. Update task status to DONE (if complete_task was called)
```

---

## 5. MCP Tools

All tools always available to platform-run agents (no agreement check required).

| Tool | Description |
|---|---|
| `get_task` | Read current task (title, description, status, priority, due date) |
| `update_task` | Update task status, description, or priority |
| `create_task` | Create a subtask in the same project |
| `get_project_tasks` | List all tasks in the project for context |
| `add_comment` | Post a comment on the task (used for progress updates) |
| `get_resource_key` | Read an encrypted resource key by name |
| `complete_task` | Mark task DONE with a summary message |

---

## 6. Logging & UI Output

### Task Comments (public, on the Kanban task)
- On start: `"🤖 [AgentName] started working on this task"`
- Mid-run: agent posts via `add_comment` tool as it sees fit
- On completion: `"✅ Done — [summary from agent]"`
- On stop/timeout: `"⚠️ Stopped after N iterations — [last status]"`

### Execution Logs (detailed, per agent run)
- Every LLM request + response (full message history)
- Every tool call: name, arguments, result
- Errors and retries with timestamps
- Stored in `AgentRunLog` table per job
- Accessible from a "Logs" panel on the task detail or agent settings page

---

## 7. Schema Changes Needed

- `Agent`: add `llmProvider`, `modelName`, `systemPrompt`, `apiKey` (encrypted), `temperature`, `maxTokens`, `maxIterations`, `enabledTools`
- `AgentProviderKey`: global API keys per provider per user (encrypted)
- `AgentRunLog`: `id`, `taskId`, `agentId`, `projectAgentId`, `status`, `iterations`, `startedAt`, `finishedAt`, `log` (JSON array of steps)
- `ProjectRole` handling: planner output creates named roles; tasks linked to roles

---

## 8. New UI Surfaces

- **Workspace Settings → API Keys**: configure global provider keys
- **Agent creation form**: basic + advanced config tabs, key override field
- **Project → Planner tab**: trigger planner, review + accept proposed roles/tasks
- **Kanban task card**: show running indicator when agent is active
- **Task detail → Logs tab**: view full execution log for the task
- **Agent settings → Run history**: all past runs with status and iteration count
