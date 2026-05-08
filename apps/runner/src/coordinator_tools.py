"""Tools available exclusively to the coordinator agent."""
import json
import logging

from src.database import get_pool
from src import events
from src.tools import _new_id, _ensure_human_project_agent

log = logging.getLogger(__name__)

COORDINATOR_TOOLS = [
    {
        "name": "get_board_state",
        "description": (
            "Read the full project board: all tasks with status, assignee type and name, "
            "dependency edges, last run result, and last 3 comments. "
            "Also returns ready_tasks — unblocked AI-assigned tasks not currently running. "
            "Always call this first."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "proceed",
        "description": (
            "Enqueue the listed AI-assigned tasks for execution. "
            "You must explicitly name which tasks to start — do not assume all ready tasks should run. "
            "Tasks must have an AI assignee and be in TODO, BACKLOG, or BLOCKED status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "IDs of tasks to enqueue.",
                },
                "reason": {"type": "string", "description": "One sentence explaining the decision."},
            },
            "required": ["task_ids", "reason"],
        },
    },
    {
        "name": "hold",
        "description": (
            "Take no action. Log the reason as a comment on the triggering task. "
            "Use when the project should wait without creating a human task."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Why the project is being held."},
            },
            "required": ["reason"],
        },
    },
    {
        "name": "escalate",
        "description": (
            "Create a human-assigned TODO task at the project level. "
            "Can be combined with proceed or hold in the same run. "
            "Use get_board_state workspace_members to find the assignee_user_id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "assignee_user_id": {"type": "string", "description": "User ID from workspace_members."},
                "priority": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "URGENT"], "default": "MEDIUM"},
            },
            "required": ["title", "description", "assignee_user_id"],
        },
    },
    {
        "name": "abort",
        "description": (
            "Mark all TODO and IN_PROGRESS tasks as BLOCKED. "
            "Post the reason as a comment on each affected task. "
            "Stops all work on the project. Only use for critical failures."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"},
            },
            "required": ["reason"],
        },
    },
]


class CoordinatorContext:
    def __init__(self, project_id: str, trigger_task_id: str, trigger_event: str,
                 coordinator_project_agent_id: str, workspace_id: str):
        self.project_id = project_id
        self.trigger_task_id = trigger_task_id
        self.trigger_event = trigger_event
        self.coordinator_project_agent_id = coordinator_project_agent_id
        self.workspace_id = workspace_id


async def execute_coordinator_tool(name: str, args: dict, ctx: CoordinatorContext) -> str:
    if name == "get_board_state":
        return await _get_board_state(ctx)
    elif name == "proceed":
        return await _proceed(args, ctx)
    elif name == "hold":
        return await _hold(args, ctx)
    elif name == "escalate":
        return await _escalate(args, ctx)
    elif name == "abort":
        return await _abort(args, ctx)
    else:
        return f"Unknown coordinator tool: {name}"


async def _get_board_state(ctx: CoordinatorContext) -> str:
    pool = await get_pool()

    project = await pool.fetchrow(
        'SELECT id, name, description, "workspaceId" FROM "Project" WHERE id = $1',
        ctx.project_id,
    )

    tasks = await pool.fetch(
        """
        SELECT t.id, t.title, t.status, t.priority,
               a.name AS assignee_name, a.type AS assignee_type,
               (SELECT status FROM "AgentRunLog" WHERE "taskId" = t.id ORDER BY id DESC LIMIT 1) AS last_run_status
        FROM "Task" t
        LEFT JOIN "ProjectAgent" pa ON pa.id = t."assigneeId"
        LEFT JOIN "Agent" a ON a.id = pa."agentId"
        WHERE t."projectId" = $1 AND t."deletedAt" IS NULL
        ORDER BY t."createdAt" ASC
        """,
        ctx.project_id,
    )

    deps = await pool.fetch(
        """
        SELECT td."blockingTaskId", td."blockedTaskId"
        FROM "TaskDependency" td
        JOIN "Task" t ON t.id = td."blockedTaskId"
        WHERE t."projectId" = $1
        """,
        ctx.project_id,
    )

    running_task_ids = set(
        r["taskId"] for r in await pool.fetch(
            """
            SELECT DISTINCT "taskId" FROM "AgentRunLog"
            WHERE status = 'RUNNING'
              AND "projectAgentId" IN (SELECT id FROM "ProjectAgent" WHERE "projectId" = $1)
            """,
            ctx.project_id,
        )
    )

    task_ids_list = [t["id"] for t in tasks]
    comments_by_task: dict = {}
    if task_ids_list:
        all_comments = await pool.fetch(
            """
            SELECT "taskId", content, "authorType", "createdAt"
            FROM (
                SELECT *,
                       ROW_NUMBER() OVER (PARTITION BY "taskId" ORDER BY "createdAt" DESC) AS rn
                FROM "TaskComment"
                WHERE "taskId" = ANY($1)
            ) sub
            WHERE rn <= 3
            """,
            task_ids_list,
        )
        for row in all_comments:
            tid = row["taskId"]
            if tid not in comments_by_task:
                comments_by_task[tid] = []
            comments_by_task[tid].append({
                "content": row["content"],
                "authorType": row["authorType"],
                "createdAt": row["createdAt"],
            })

    blocked_by: dict[str, list] = {}
    for d in deps:
        blocked_by.setdefault(d["blockedTaskId"], []).append(d["blockingTaskId"])

    members = await pool.fetch(
        """
        SELECT u.id AS user_id, u.name, wm.role
        FROM "WorkspaceMember" wm
        JOIN "User" u ON u.id = wm."userId"
        WHERE wm."workspaceId" = $1
        ORDER BY CASE wm.role WHEN 'OWNER' THEN 0 ELSE 1 END
        """,
        project["workspaceId"],
    )

    # Find BLOCKED tasks whose all blocking tasks are DONE (newly unblocked)
    unblocked_blocked_task_ids = set(
        r["id"] for r in await pool.fetch(
            """
            SELECT t.id
            FROM "Task" t
            WHERE t."projectId" = $1
              AND t.status = 'BLOCKED'::"TaskStatus"
              AND t."deletedAt" IS NULL
              AND t."assigneeId" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM "TaskDependency" td
                JOIN "Task" bt ON bt.id = td."blockingTaskId"
                WHERE td."blockedTaskId" = t.id
                  AND bt.status != 'DONE'::"TaskStatus"
              )
            """,
            ctx.project_id,
        )
    )

    task_list = []
    ready_tasks = []
    for t in tasks:
        blocked_by_list = blocked_by.get(t["id"], [])
        is_effectively_unblocked = t["id"] in unblocked_blocked_task_ids
        is_ready = (
            (t["status"] in ("TODO", "BACKLOG") or is_effectively_unblocked)
            and t["assignee_type"] == "AI"
            and t["id"] not in running_task_ids
        )
        entry = {
            "id": t["id"],
            "title": t["title"],
            "status": t["status"],
            "priority": t["priority"],
            "assignee": t["assignee_name"],
            "assignee_type": t["assignee_type"],
            "last_run_status": t["last_run_status"],
            "blocked_by": blocked_by_list,
            "all_blockers_done": is_effectively_unblocked,
            "recent_comments": comments_by_task.get(t["id"], []),
        }
        task_list.append(entry)
        if is_ready:
            ready_tasks.append({"id": t["id"], "title": t["title"]})

    return json.dumps({
        "project": {"id": project["id"], "name": project["name"]},
        "trigger": {"task_id": ctx.trigger_task_id, "event": ctx.trigger_event},
        "tasks": task_list,
        "ready_tasks": ready_tasks,
        "workspace_members": [dict(m) for m in members],
    }, default=str)


async def _proceed(args: dict, ctx: CoordinatorContext) -> str:
    import redis.asyncio as aioredis
    from src.config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, STREAM_NAME
    pool = await get_pool()
    task_ids = args["task_ids"]
    reason = args["reason"]
    results = []

    for task_id in task_ids:
        task = await pool.fetchrow(
            """
            SELECT t.id, t.status, t."assigneeId",
                   pa."agentId", a.type AS agent_type,
                   p."workspaceId"
            FROM "Task" t
            JOIN "ProjectAgent" pa ON pa.id = t."assigneeId"
            JOIN "Agent" a ON a.id = pa."agentId"
            JOIN "Project" p ON p.id = t."projectId"
            WHERE t.id = $1 AND t."projectId" = $2
            """,
            task_id,
            ctx.project_id,
        )
        if not task:
            results.append(f"{task_id}: not found")
            continue
        if task["agent_type"] != "AI":
            results.append(f"{task_id}: not an AI-assigned task")
            continue

        if task["status"] not in ("TODO", "BACKLOG", "BLOCKED"):
            results.append(f"{task_id}: already in status {task['status']}")
            continue

        if task["status"] != "TODO":
            await pool.execute(
                'UPDATE "Task" SET status = \'TODO\'::"TaskStatus", "updatedAt" = NOW() WHERE id = $1',
                task_id,
            )
            await events.publish("task:updated", {
                "projectId": ctx.project_id,
                "task": {"id": task_id, "status": "TODO"},
            })

        running = await pool.fetchval(
            'SELECT id FROM "AgentRunLog" WHERE "taskId" = $1 AND status = \'RUNNING\' LIMIT 1',
            task_id,
        )
        if running:
            results.append(f"{task_id}: already running")
            continue

        run_log_id = _new_id()
        await pool.execute(
            """
            INSERT INTO "AgentRunLog" (id, "taskId", "agentId", "projectAgentId", status, "startedAt")
            VALUES ($1, $2, $3, $4, 'RUNNING'::"AgentRunStatus", NOW())
            """,
            run_log_id, task_id, task["agentId"], task["assigneeId"],
        )

        redis_client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD)
        try:
            await redis_client.xadd(
                STREAM_NAME, {
                    "taskId": task_id,
                    "agentId": task["agentId"],
                    "projectAgentId": task["assigneeId"],
                    "projectId": ctx.project_id,
                    "workspaceId": task["workspaceId"],
                    "runLogId": run_log_id,
                },
            )
        finally:
            await redis_client.aclose()

        results.append(f"{task_id}: enqueued")

    await _post_coordinator_comment(ctx.trigger_task_id, ctx, f"**Coordinator: proceed.**\n\n{reason}")
    return json.dumps(results)


async def _hold(args: dict, ctx: CoordinatorContext) -> str:
    reason = args["reason"]
    await _post_coordinator_comment(ctx.trigger_task_id, ctx, f"**Coordinator: hold.**\n\n{reason}")
    return "STOP"


async def _escalate(args: dict, ctx: CoordinatorContext) -> str:
    pool = await get_pool()
    priority = args.get("priority", "MEDIUM")

    assignee_pa_id, assignee_name = await _ensure_human_project_agent(
        args["assignee_user_id"], ctx.project_id, pool
    )

    new_task_id = _new_id()
    await pool.execute(
        """
        INSERT INTO "Task" (id, "projectId", title, description, status, priority,
                            "reporterId", "reporterType", "assigneeId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'TODO'::"TaskStatus", $5::"TaskPriority",
                $6, 'agent', $7, NOW(), NOW())
        """,
        new_task_id, ctx.project_id, args["title"], args["description"],
        priority, ctx.coordinator_project_agent_id, assignee_pa_id,
    )
    await events.publish("task:created", {
        "projectId": ctx.project_id,
        "task": {"id": new_task_id, "title": args["title"], "status": "TODO"},
    })

    await _post_coordinator_comment(
        ctx.trigger_task_id, ctx,
        f"**Coordinator: escalate.**\n\nCreated task for {assignee_name}: **{args['title']}**",
    )
    return f"Escalation task created: {new_task_id}"


async def _abort(args: dict, ctx: CoordinatorContext) -> str:
    pool = await get_pool()
    reason = args["reason"]

    tasks = await pool.fetch(
        """
        UPDATE "Task"
        SET status = 'BLOCKED'::"TaskStatus", "updatedAt" = NOW()
        WHERE "projectId" = $1
          AND status IN ('TODO'::"TaskStatus", 'IN_PROGRESS'::"TaskStatus", 'BACKLOG'::"TaskStatus")
          AND "deletedAt" IS NULL
        RETURNING id
        """,
        ctx.project_id,
    )

    for t in tasks:
        await _post_coordinator_comment(t["id"], ctx, f"**Coordinator: abort.**\n\n{reason}")
        await events.publish("task:updated", {
            "projectId": ctx.project_id,
            "task": {"id": t["id"], "status": "BLOCKED"},
        })

    return f"STOP — aborted {len(tasks)} task(s)."


async def _post_coordinator_comment(task_id: str, ctx: CoordinatorContext, content: str) -> None:
    pool = await get_pool()
    exists = await pool.fetchval('SELECT id FROM "Task" WHERE id = $1', task_id)
    if not exists:
        return
    comment_id = _new_id()
    await pool.execute(
        """
        INSERT INTO "TaskComment" (id, "taskId", "authorId", "authorType", content, "createdAt")
        VALUES ($1, $2, $3, 'agent', $4, NOW())
        """,
        comment_id, task_id, ctx.coordinator_project_agent_id, content,
    )
    await events.publish("comment:created", {
        "projectId": ctx.project_id,
        "taskId": task_id,
        "comment": {"id": comment_id, "content": content, "authorType": "agent"},
    })
