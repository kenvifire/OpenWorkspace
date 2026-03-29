"""MCP tool implementations — direct Postgres reads/writes via asyncpg."""
import json
import logging
from datetime import datetime, timezone
import httpx
from cuid2 import Cuid as _Cuid
from src.database import get_pool
from src.encryption import decrypt
from src import events

log = logging.getLogger(__name__)

_cuid_gen = _Cuid()

def _new_id() -> str:
    return _cuid_gen.generate()

TIMEOUT = httpx.Timeout(30.0)

# ── Tool definitions (sent to LLM) ──────────────────────────────────────────

ALL_TOOLS: list[dict] = [
    {
        "name": "get_task",
        "description": "Retrieve a task by ID, including its title, description, status, priority, and assignee.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task ID to retrieve."},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "update_task",
        "description": "Update a task's title, description, status, or priority.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "status": {
                    "type": "string",
                    "enum": ["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"],
                },
                "priority": {
                    "type": "string",
                    "enum": ["LOW", "MEDIUM", "HIGH", "URGENT"],
                },
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "create_task",
        "description": "Create a new task in the project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "status": {
                    "type": "string",
                    "enum": ["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"],
                    "default": "BACKLOG",
                },
                "priority": {
                    "type": "string",
                    "enum": ["LOW", "MEDIUM", "HIGH", "URGENT"],
                    "default": "MEDIUM",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "get_project_info",
        "description": (
            "Fetch full context about the current project: name, description, "
            "hired agents with their roles, and a task summary grouped by status. "
            "Call this at the start of a task to understand the project and team."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_project_tasks",
        "description": "List all tasks in the current project with their status, priority, assignee, and description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"],
                    "description": "Optional: filter tasks by status.",
                },
            },
        },
    },
    {
        "name": "add_comment",
        "description": "Post a comment on a task. Use this for status updates and progress summaries visible to humans.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["task_id", "content"],
        },
    },
    {
        "name": "get_resource_key",
        "description": "Retrieve a decrypted resource key by name (e.g. API keys, tokens, secrets). The returned value is the raw secret — use it directly in request headers, e.g. for GitHub tokens set header 'Authorization' to 'Bearer <token>' or 'token <token>'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "key_name": {"type": "string", "description": "The name of the resource key."},
            },
            "required": ["key_name"],
        },
    },
    {
        "name": "complete_task",
        "description": "Mark the current task as DONE and post a completion summary comment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "Summary of what was accomplished."},
            },
            "required": ["summary"],
        },
    },
    {
        "name": "block_task",
        "description": "Mark the current task as BLOCKED when you cannot proceed due to a missing resource, permission, or dependency. Explain clearly what is needed so a human can unblock it.",
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Clear explanation of what is blocking progress and what is needed to unblock."},
            },
            "required": ["reason"],
        },
    },
    {
        "name": "http_request",
        "description": "Make an HTTP request to an external API. Use this to interact with services like GitHub, Jira, Slack, etc. Always include authentication headers — for GitHub use {'Authorization': 'token <github_token>', 'Accept': 'application/vnd.github+json'}.",
        "input_schema": {
            "type": "object",
            "properties": {
                "method": {"type": "string", "description": "HTTP method: GET, POST, PUT, PATCH, DELETE."},
                "url": {"type": "string", "description": "Full URL to call."},
                "headers": {"type": "object", "description": "HTTP headers as key-value pairs (optional)."},
                "body": {"type": "object", "description": "JSON request body (optional, for POST/PUT/PATCH)."},
                "params": {"type": "object", "description": "URL query parameters as key-value pairs (optional)."},
            },
            "required": ["method", "url"],
        },
    },
]


# Sandbox tools — only included when an E2B sandbox is active for the run
SANDBOX_TOOLS: list[dict] = [
    {
        "name": "run_shell",
        "description": (
            "Execute a shell command inside the secure sandbox environment. "
            "Use this to run build tools (cmake, make, cargo, npm, pip), "
            "git operations (clone, add, commit, push), tests, linters, or any CLI tool. "
            "Commands run as root in a full Ubuntu environment with common dev tools pre-installed. "
            "The working directory persists across calls within the same task run. "
            "Always check exit_code — non-zero means the command failed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Shell command to execute. Can be multi-line or chained with && or ;",
                },
                "workdir": {
                    "type": "string",
                    "description": "Working directory for the command (default: /home/user). Use absolute paths.",
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds (default 60, max 300).",
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "write_file",
        "description": (
            "Write content to a file in the sandbox. Creates parent directories automatically. "
            "Use for writing source code, config files, CMakeLists.txt, Makefiles, etc. "
            "Prefer this over echo redirection in run_shell for multi-line file content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute path to the file (e.g. /home/user/project/src/main.cpp).",
                },
                "content": {
                    "type": "string",
                    "description": "Full file content to write.",
                },
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a file from the sandbox. Use to inspect generated files, build output, logs, or configs.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute path to the file to read.",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_files",
        "description": "List files and directories at a path in the sandbox.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute directory path to list (default: /home/user).",
                },
            },
        },
    },
]


def get_enabled_tools(enabled_tool_names: list[str]) -> list[dict]:
    """Return tool definitions filtered to enabled names, or all if list is empty."""
    if not enabled_tool_names:
        return ALL_TOOLS
    return [t for t in ALL_TOOLS if t["name"] in enabled_tool_names]


# ── Tool executor ────────────────────────────────────────────────────────────

class ToolContext:
    def __init__(
        self,
        task_id: str,
        project_id: str,
        project_agent_id: str,
        workspace_id: str,
        sandbox=None,  # e2b.AsyncSandbox instance, or None if not configured
    ):
        self.task_id = task_id
        self.project_id = project_id
        self.project_agent_id = project_agent_id
        self.workspace_id = workspace_id
        self.sandbox = sandbox


async def execute_tool(name: str, args: dict, ctx: ToolContext, tool_def: dict | None = None) -> str:
    """Execute a tool and return a string result."""
    # Webhook skill (dynamic tool registered from ProjectAgentSkill)
    if tool_def and "_webhook" in tool_def:
        return await _call_webhook(tool_def["_webhook"], args)

    if name == "get_task":
        return await _get_task(args["task_id"], ctx)
    elif name == "update_task":
        return await _update_task(args, ctx)
    elif name == "create_task":
        return await _create_task(args, ctx)
    elif name == "get_project_info":
        return await _get_project_info(ctx)
    elif name == "get_project_tasks":
        return await _get_project_tasks(ctx, status=args.get("status"))
    elif name == "add_comment":
        return await _add_comment(args["task_id"], args["content"], ctx)
    elif name == "get_resource_key":
        return await _get_resource_key(args["key_name"], ctx)
    elif name == "complete_task":
        return await _complete_task(args["summary"], ctx)
    elif name == "block_task":
        return await _block_task(args["reason"], ctx)
    elif name == "http_request":
        return await _http_request(args)
    elif name == "run_shell":
        return await _run_shell(args, ctx)
    elif name == "write_file":
        return await _write_file(args, ctx)
    elif name == "read_file":
        return await _read_file(args, ctx)
    elif name == "list_files":
        return await _list_files(args, ctx)
    else:
        return f"Unknown tool: {name}"


# ── Individual tool implementations ─────────────────────────────────────────

async def _get_task(task_id: str, ctx: ToolContext) -> str:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT t.id, t.title, t.description, t.status, t.priority,
               pa.id AS assignee_id
        FROM "Task" t
        LEFT JOIN "ProjectAgent" pa ON pa.id = t."assigneeId"
        WHERE t.id = $1 AND t."projectId" = $2
        """,
        task_id,
        ctx.project_id,
    )
    if not row:
        return f"Task {task_id} not found."
    return json.dumps(dict(row))


async def _update_task(args: dict, ctx: ToolContext) -> str:
    task_id = args["task_id"]
    pool = await get_pool()

    # Build dynamic SET clause
    fields = {k: v for k, v in args.items() if k != "task_id" and v is not None}
    if not fields:
        return "No fields to update."

    col_map = {"title": "title", "description": "description", "status": "status", "priority": "priority"}
    set_parts = []
    values: list = []
    idx = 1
    for key, val in fields.items():
        if key in col_map:
            set_parts.append(f'"{col_map[key]}" = ${idx}')
            values.append(val)
            idx += 1

    values.append(task_id)
    values.append(ctx.project_id)

    row = await pool.fetchrow(
        f"""
        UPDATE "Task"
        SET {", ".join(set_parts)}, "updatedAt" = NOW()
        WHERE id = ${idx} AND "projectId" = ${idx + 1}
        RETURNING id, title, status, priority
        """,
        *values,
    )
    if not row:
        return f"Task {task_id} not found or update failed."

    await _record_activity(task_id, ctx, "update_task", fields)
    await events.publish("task:updated", {"projectId": ctx.project_id, "task": dict(row)})
    return json.dumps(dict(row))


async def _create_task(args: dict, ctx: ToolContext) -> str:
    pool = await get_pool()
    new_id = _new_id()
    status = args.get("status", "BACKLOG")
    priority = args.get("priority", "MEDIUM")

    row = await pool.fetchrow(
        """
        INSERT INTO "Task" (id, "projectId", title, description, status, priority,
                            "reporterId", "reporterType", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5::"TaskStatus", $6::"TaskPriority",
                $7, 'agent', NOW(), NOW())
        RETURNING id, title, status, priority
        """,
        new_id,
        ctx.project_id,
        args["title"],
        args.get("description", ""),
        status,
        priority,
        ctx.project_agent_id,
    )
    await events.publish("task:created", {"projectId": ctx.project_id, "task": dict(row)})
    return json.dumps(dict(row))


async def _get_project_info(ctx: ToolContext) -> str:
    pool = await get_pool()

    project = await pool.fetchrow(
        'SELECT id, name, description FROM "Project" WHERE id = $1',
        ctx.project_id,
    )
    if not project:
        return "Project not found."

    agents = await pool.fetch(
        """
        SELECT pa.id, pa.role, pa."customRole", a.name, a.type
        FROM "ProjectAgent" pa
        JOIN "Agent" a ON a.id = pa."agentId"
        WHERE pa."projectId" = $1
        ORDER BY pa."hiredAt" ASC
        """,
        ctx.project_id,
    )

    task_counts = await pool.fetch(
        """
        SELECT status, COUNT(*) AS count
        FROM "Task"
        WHERE "projectId" = $1
        GROUP BY status
        """,
        ctx.project_id,
    )

    return json.dumps({
        "id": project["id"],
        "name": project["name"],
        "description": project["description"],
        "agents": [
            {
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "role": r["customRole"] if r["role"] == "CUSTOM" else r["role"],
            }
            for r in agents
        ],
        "task_summary": {r["status"]: r["count"] for r in task_counts},
    })


async def _get_project_tasks(ctx: ToolContext, status: str | None = None) -> str:
    pool = await get_pool()
    if status:
        rows = await pool.fetch(
            """
            SELECT t.id, t.title, t.description, t.status, t.priority,
                   a.name AS assignee_name
            FROM "Task" t
            LEFT JOIN "ProjectAgent" pa ON pa.id = t."assigneeId"
            LEFT JOIN "Agent" a ON a.id = pa."agentId"
            WHERE t."projectId" = $1 AND t.status = $2::"TaskStatus"
            ORDER BY t."createdAt" ASC
            """,
            ctx.project_id,
            status,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT t.id, t.title, t.description, t.status, t.priority,
                   a.name AS assignee_name
            FROM "Task" t
            LEFT JOIN "ProjectAgent" pa ON pa.id = t."assigneeId"
            LEFT JOIN "Agent" a ON a.id = pa."agentId"
            WHERE t."projectId" = $1
            ORDER BY t."createdAt" ASC
            """,
            ctx.project_id,
        )
    return json.dumps([dict(r) for r in rows])


async def _add_comment(task_id: str, content: str, ctx: ToolContext) -> str:
    pool = await get_pool()
    exists = await pool.fetchval('SELECT id FROM "Task" WHERE id = $1 AND "deletedAt" IS NULL', task_id)
    if not exists:
        return f"Task {task_id} not found."
    new_id = _new_id()

    await pool.execute(
        """
        INSERT INTO "TaskComment" (id, "taskId", "authorId", "authorType", content, "createdAt")
        VALUES ($1, $2, $3, 'agent', $4, NOW())
        """,
        new_id,
        task_id,
        ctx.project_agent_id,
        content,
    )
    await events.publish("comment:created", {
        "projectId": ctx.project_id,
        "taskId": task_id,
        "comment": {"id": new_id, "content": content, "authorType": "agent"},
    })
    return "Comment posted."


async def _get_resource_key(key_name: str, ctx: ToolContext) -> str:
    import difflib
    pool = await get_pool()
    rows = await pool.fetch(
        'SELECT id, name, "encryptedValue" FROM "ResourceKey" WHERE "projectId" = $1',
        ctx.project_id,
    )
    if not rows:
        return f"Resource key '{key_name}' not found."

    # Normalize: lowercase + replace separators with spaces for matching
    def normalize(s: str) -> str:
        return s.lower().replace("_", " ").replace("-", " ")

    needle = normalize(key_name)
    names = [r["name"] for r in rows]
    matches = difflib.get_close_matches(needle, [normalize(n) for n in names], n=1, cutoff=0.4)
    if not matches:
        return f"Resource key '{key_name}' not found. Available keys: {', '.join(names)}"

    matched_name = names[[normalize(n) for n in names].index(matches[0])]
    row = next(r for r in rows if r["name"] == matched_name)
    if not row:
        return f"Resource key '{key_name}' not found."

    # Audit log
    audit_id = _new_id()
    await pool.execute(
        """
        INSERT INTO "AuditLog" (id, "workspaceId", "projectId", "actorId", "actorType",
                                action, "resourceType", "resourceId", "createdAt")
        VALUES ($1, $2, $3, $4, 'agent', 'READ_RESOURCE_KEY', 'ResourceKey', $5, NOW())
        """,
        audit_id,
        ctx.workspace_id,
        ctx.project_id,
        ctx.project_agent_id,
        row["id"],
    )
    plaintext = decrypt(row["encryptedValue"])
    name_lower = row["name"].lower()
    if "github" in name_lower:
        return f"GitHub token retrieved. Use it in http_request headers as: {{\"Authorization\": \"token {plaintext}\", \"Accept\": \"application/vnd.github+json\"}}"
    return plaintext


async def _complete_task(summary: str, ctx: ToolContext) -> str:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE "Task"
        SET status = 'DONE'::"TaskStatus", "updatedAt" = NOW()
        WHERE id = $1 AND "projectId" = $2
        RETURNING id, title, status
        """,
        ctx.task_id,
        ctx.project_id,
    )
    if not row:
        return f"Task {ctx.task_id} not found."

    # Publish WS event immediately after DB update (before anything that could throw)
    await events.publish("task:updated", {"projectId": ctx.project_id, "task": dict(row)})

    # Post summary comment and activity (non-fatal)
    try:
        await _add_comment(ctx.task_id, f"**Task completed.**\n\n{summary}", ctx)
        await _record_activity(ctx.task_id, ctx, "complete_task", {"summary": summary})
    except Exception:
        log.exception("complete_task: failed to post comment/activity for task %s", ctx.task_id)

    # Unblock dependent tasks (non-fatal)
    try:
        await _unblock_dependents(ctx.task_id, ctx.project_id, pool)
    except Exception:
        log.exception("complete_task: failed to unblock dependents for task %s", ctx.task_id)

    return "Task marked as DONE."


async def _block_task(reason: str, ctx: ToolContext) -> str:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE "Task"
        SET status = 'BLOCKED'::"TaskStatus", "updatedAt" = NOW()
        WHERE id = $1 AND "projectId" = $2
        RETURNING id, title, status
        """,
        ctx.task_id,
        ctx.project_id,
    )
    if not row:
        return f"Task {ctx.task_id} not found."

    await _add_comment(ctx.task_id, f"**Task blocked.**\n\n{reason}", ctx)
    await events.publish("task:updated", {"projectId": ctx.project_id, "task": dict(row)})
    return "STOP"


async def _unblock_dependents(completed_task_id: str, project_id: str, pool) -> None:
    """For each task blocked by completed_task_id, check if all its blockers are now DONE.
    If so, move it to TODO and enqueue it for the agent runner."""
    import redis.asyncio as aioredis
    from src.config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, STREAM_NAME

    # Find tasks that were blocked by the just-completed task
    blocked_tasks = await pool.fetch(
        """
        SELECT td."blockedTaskId"
        FROM "TaskDependency" td
        WHERE td."blockingTaskId" = $1
        """,
        completed_task_id,
    )

    for row in blocked_tasks:
        blocked_id = row["blockedTaskId"]

        # Check if ALL blocking tasks for this task are now DONE
        remaining_blockers = await pool.fetchval(
            """
            SELECT COUNT(*)
            FROM "TaskDependency" td
            JOIN "Task" t ON t.id = td."blockingTaskId"
            WHERE td."blockedTaskId" = $1
              AND t.status != 'DONE'::"TaskStatus"
            """,
            blocked_id,
        )

        if remaining_blockers > 0:
            continue  # Still has other blockers

        # All clear — move to TODO if it has an assignee, else BACKLOG
        task_row = await pool.fetchrow(
            """
            UPDATE "Task"
            SET status = CASE WHEN "assigneeId" IS NOT NULL THEN 'TODO'::"TaskStatus"
                              ELSE 'BACKLOG'::"TaskStatus" END,
                "updatedAt" = NOW()
            WHERE id = $1 AND status = 'BLOCKED'::"TaskStatus"
            RETURNING id, status, "assigneeId", "projectId",
                      (SELECT "agentId" FROM "ProjectAgent" WHERE id = "assigneeId") AS agent_id
            """,
            blocked_id,
        )
        if not task_row:
            continue

        await events.publish("task:updated", {
            "projectId": project_id,
            "task": {"id": task_row["id"], "status": task_row["status"]},
        })

        # Enqueue agent run if assignee is an AI agent
        if task_row["status"] == "TODO" and task_row["assigneeId"] and task_row["agent_id"]:
            pa_row = await pool.fetchrow(
                """
                SELECT pa.id, pa."projectId", p."workspaceId"
                FROM "ProjectAgent" pa
                JOIN "Project" p ON p.id = pa."projectId"
                WHERE pa.id = $1
                """,
                task_row["assigneeId"],
            )
            if pa_row:
                run_log_id = _new_id()
                await pool.execute(
                    """
                    INSERT INTO "AgentRunLog" (id, "taskId", "agentId", "projectAgentId", status, "startedAt")
                    VALUES ($1, $2, $3, $4, 'RUNNING'::"AgentRunStatus", NOW())
                    """,
                    run_log_id,
                    blocked_id,
                    task_row["agent_id"],
                    task_row["assigneeId"],
                )
                redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD)
                try:
                    await redis_client.xadd(
                        STREAM_NAME, {
                            "taskId": blocked_id,
                            "agentId": task_row["agent_id"],
                            "projectAgentId": task_row["assigneeId"],
                            "projectId": pa_row["projectId"],
                            "workspaceId": pa_row["workspaceId"],
                            "runLogId": run_log_id,
                        },
                    )
                finally:
                    await redis_client.aclose()


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _http_request(args: dict) -> str:
    method = args["method"].upper()
    url = args["url"]
    headers = args.get("headers") or {}
    body = args.get("body")
    params = args.get("params")

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.request(
            method, url,
            headers=headers,
            json=body if body is not None else None,
            params=params,
        )
        try:
            data = resp.json()
            return json.dumps({"status": resp.status_code, "body": data})
        except Exception:
            return json.dumps({"status": resp.status_code, "body": resp.text})


async def _call_webhook(webhook: dict, args: dict) -> str:
    url = webhook["url"]
    method = (webhook.get("method") or "POST").upper()
    headers = {"Content-Type": "application/json"}
    if webhook.get("headers"):
        try:
            extra = json.loads(webhook["headers"])
            headers.update(extra)
        except Exception:
            pass

    body_str = args.get("body", "{}")
    try:
        body = json.loads(body_str) if body_str else {}
    except Exception:
        body = {"raw": body_str}

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.request(method, url, headers=headers, json=body)
        resp.raise_for_status()
        try:
            return json.dumps(resp.json())
        except Exception:
            return resp.text


async def _record_activity(task_id: str, ctx: ToolContext, action: str, metadata: dict) -> None:
    pool = await get_pool()
    exists = await pool.fetchval('SELECT id FROM "Task" WHERE id = $1 AND "deletedAt" IS NULL', task_id)
    if not exists:
        return
    await pool.execute(
        """
        INSERT INTO "TaskActivity" (id, "taskId", "actorId", "actorType", action, metadata, "createdAt")
        VALUES ($1, $2, $3, 'agent', $4, $5, NOW())
        """,
        _new_id(),
        task_id,
        ctx.project_agent_id,
        action,
        json.dumps(metadata),
    )


# ── Sandbox tool implementations ─────────────────────────────────────────────

_SANDBOX_NO_SBX = "Sandbox is not available for this agent run. Enable it by setting E2B_API_KEY in the runner environment."

# Truncate long output so it doesn't flood the LLM context
_MAX_OUTPUT = 8000


def _truncate(text: str) -> str:
    if len(text) <= _MAX_OUTPUT:
        return text
    half = _MAX_OUTPUT // 2
    return text[:half] + f"\n\n... [{len(text) - _MAX_OUTPUT} chars truncated] ...\n\n" + text[-half:]


async def _run_shell(args: dict, ctx: ToolContext) -> str:
    if not ctx.sandbox:
        return _SANDBOX_NO_SBX

    command = args["command"]
    workdir = args.get("workdir", "/home/user")
    timeout = min(int(args.get("timeout", 60)), 300)

    try:
        result = await ctx.sandbox.commands.run(
            command,
            cwd=workdir,
            timeout=timeout,
        )
        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()
        exit_code = result.exit_code

        output_parts = []
        if stdout:
            output_parts.append(f"stdout:\n{stdout}")
        if stderr:
            output_parts.append(f"stderr:\n{stderr}")
        output = "\n".join(output_parts) if output_parts else "(no output)"

        return json.dumps({
            "exit_code": exit_code,
            "output": _truncate(output),
            "success": exit_code == 0,
        })
    except Exception as e:
        return json.dumps({"exit_code": -1, "output": str(e), "success": False})


async def _write_file(args: dict, ctx: ToolContext) -> str:
    if not ctx.sandbox:
        return _SANDBOX_NO_SBX

    path = args["path"]
    content = args["content"]

    try:
        # Ensure parent directory exists
        import os as _os
        parent = _os.path.dirname(path)
        if parent and parent != "/":
            await ctx.sandbox.commands.run(f"mkdir -p {parent}")

        await ctx.sandbox.files.write(path, content)
        return json.dumps({"success": True, "path": path, "bytes": len(content.encode())})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


async def _read_file(args: dict, ctx: ToolContext) -> str:
    if not ctx.sandbox:
        return _SANDBOX_NO_SBX

    path = args["path"]
    try:
        content = await ctx.sandbox.files.read(path)
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="replace")
        return _truncate(content)
    except Exception as e:
        return json.dumps({"error": str(e)})


async def _list_files(args: dict, ctx: ToolContext) -> str:
    if not ctx.sandbox:
        return _SANDBOX_NO_SBX

    path = args.get("path", "/home/user")
    try:
        entries = await ctx.sandbox.files.list(path)
        items = [
            {"name": e.name, "type": "dir" if e.is_dir else "file"}
            for e in entries
        ]
        return json.dumps(items)
    except Exception as e:
        return json.dumps({"error": str(e)})
