"""Redis Stream consumer — agentic loop."""
import asyncio
import json
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis

from src.config import (
    REDIS_HOST, REDIS_PORT, REDIS_PASSWORD,
    STREAM_NAME, CONSUMER_GROUP, CONSUMER_NAME,
    E2B_API_KEY,
)
from src.database import get_pool
from src.encryption import decrypt
from src.llm import call_llm
from src.tools import ToolContext, execute_tool, get_enabled_tools, SANDBOX_TOOLS
from src import events

# Optional E2B import — runner works without it if E2B_API_KEY is not set
try:
    from e2b import AsyncSandbox as _AsyncSandbox
    _E2B_AVAILABLE = True
except ImportError:
    _AsyncSandbox = None  # type: ignore
    _E2B_AVAILABLE = False

log = logging.getLogger(__name__)

# How long to block waiting for new stream messages (ms)
BLOCK_MS = 5000
# How often to poll for unACKed (pending) messages claimed back from crashed consumers
CLAIM_INTERVAL_S = 60
# Min idle time before claiming a pending message (ms)
CLAIM_IDLE_MS = 30_000

# Tool names whose results contain secrets and must not appear in logs or the DB
SENSITIVE_TOOLS = {"get_resource_key"}


# ── Entry point ──────────────────────────────────────────────────────────────

async def run_consumer() -> None:
    """Start the Redis Stream consumer loop."""
    client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD)

    # Ensure consumer group exists (MKSTREAM creates stream if absent)
    try:
        await client.xgroup_create(STREAM_NAME, CONSUMER_GROUP, id="0", mkstream=True)
        log.info("Consumer group '%s' created.", CONSUMER_GROUP)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise
        log.info("Consumer group '%s' already exists.", CONSUMER_GROUP)

    claim_task = asyncio.create_task(_claim_loop(client))
    try:
        await _read_loop(client)
    finally:
        claim_task.cancel()
        await client.aclose()


async def _read_loop(client: aioredis.Redis) -> None:
    log.info("Runner '%s' listening on stream '%s'.", CONSUMER_NAME, STREAM_NAME)
    while True:
        results = await client.xreadgroup(
            groupname=CONSUMER_GROUP,
            consumername=CONSUMER_NAME,
            streams={STREAM_NAME: ">"},
            count=1,
            block=BLOCK_MS,
        )
        if not results:
            continue
        for _stream, messages in results:
            for msg_id, fields in messages:
                job = {k.decode(): v.decode() for k, v in fields.items()}
                log.info("Processing job %s: %s", msg_id.decode(), job)
                try:
                    await _process_job(job)
                    await client.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)
                    log.info("ACKed message %s", msg_id.decode())
                except Exception:
                    log.exception("Job %s failed — leaving unACKed for retry", msg_id.decode())


async def _claim_loop(client: aioredis.Redis) -> None:
    """Periodically claim idle pending messages from crashed consumers."""
    await asyncio.sleep(CLAIM_INTERVAL_S)
    while True:
        try:
            pending = await client.xpending_range(
                STREAM_NAME, CONSUMER_GROUP, min="-", max="+", count=10
            )
            for entry in pending:
                msg_id = entry["message_id"]
                idle = entry.get("time_since_delivered", 0)
                if idle >= CLAIM_IDLE_MS:
                    claimed = await client.xclaim(
                        STREAM_NAME, CONSUMER_GROUP, CONSUMER_NAME, CLAIM_IDLE_MS, [msg_id]
                    )
                    if claimed:
                        log.info("Claimed idle message %s", msg_id)
        except Exception:
            log.exception("Error in claim loop")
        await asyncio.sleep(CLAIM_INTERVAL_S)


# ── Job processor ────────────────────────────────────────────────────────────

async def _process_job(job: dict) -> None:
    run_log_id: str = job["runLogId"]
    task_id: str = job["taskId"]
    agent_id: str = job["agentId"]
    project_agent_id: str = job["projectAgentId"]
    project_id: str = job["projectId"]
    workspace_id: str = job["workspaceId"]
    is_wake: bool = job.get("wake", "false").lower() == "true"

    pool = await get_pool()

    # Load agent config
    agent = await pool.fetchrow(
        """
        SELECT "llmProvider", "modelName", "systemPrompt", "encryptedApiKey",
               temperature, "maxTokens", "maxIterations", "enabledTools"
        FROM "Agent"
        WHERE id = $1
        """,
        agent_id,
    )
    if not agent:
        raise ValueError(f"Agent {agent_id} not found")

    # Load project sandbox config
    project_row = await pool.fetchrow(
        'SELECT "sandboxProvider", "workspaceId" FROM "Project" WHERE id = $1',
        project_id,
    )
    sandbox_provider: str | None = project_row["sandboxProvider"] if project_row else None

    max_iterations: int = agent["maxIterations"] or 20
    enabled_tools_raw = agent["enabledTools"] or []

    # Resolve API key: agent-level override → workspace provider key → error
    api_key = await _resolve_api_key(
        agent["encryptedApiKey"], agent["llmProvider"], workspace_id, pool
    )

    provider: str = agent["llmProvider"]
    model: str = agent["modelName"]
    system_prompt: str = agent["systemPrompt"] or "You are a helpful AI assistant working on a project task."
    temperature: float = agent["temperature"] if agent["temperature"] is not None else 0.7
    max_tokens: int = agent["maxTokens"] or 4096
    tools = get_enabled_tools(list(enabled_tools_raw))

    # Load project-agent-level skills and MCPs
    pa_skills = await pool.fetch(
        """
        SELECT s.id, s.name, s.description, s.instructions, s.type,
               s."webhookUrl", s."webhookMethod", s."webhookHeaders"
        FROM "ProjectAgentSkill" pas
        JOIN "Skill" s ON s.id = pas."skillId"
        WHERE pas."projectAgentId" = $1
        ORDER BY pas."assignedAt" ASC
        """,
        project_agent_id,
    )
    pa_mcps = await pool.fetch(
        """
        SELECT m.id, m.name, m.description, m.transport, m.url, m.command, m.args, m.headers
        FROM "ProjectAgentMcp" pam
        JOIN "Mcp" m ON m.id = pam."mcpId"
        WHERE pam."projectAgentId" = $1
        ORDER BY pam."assignedAt" ASC
        """,
        project_agent_id,
    )

    # Inject PROMPT skills into system prompt
    prompt_skills = [s for s in pa_skills if s["type"] == "PROMPT"]
    if prompt_skills:
        skill_block = "\n\n---\n## Skills\n" + "\n\n".join(
            f"### {s['name']}\n{s['instructions']}" for s in prompt_skills
        )
        system_prompt += skill_block

    # Register WEBHOOK skills as callable tools
    webhook_skills = [s for s in pa_skills if s["type"] == "WEBHOOK"]
    for s in webhook_skills:
        tools.append({
            "name": f"skill_{s['name'].lower().replace(' ', '_')}",
            "description": s["description"],
            "input_schema": {
                "type": "object",
                "properties": {
                    "body": {"type": "string", "description": "JSON body to send to the webhook (optional)."},
                },
            },
            "_webhook": {
                "url": s["webhookUrl"],
                "method": s["webhookMethod"] or "POST",
                "headers": s["webhookHeaders"],
            },
        })

    # Log MCP configs (full MCP protocol execution not yet implemented)
    if pa_mcps:
        mcp_names = ", ".join(m["name"] for m in pa_mcps)
        log.info("Run %s: MCPs configured (not yet executed): %s", run_log_id, mcp_names)
        system_prompt += f"\n\n---\n## Configured MCPs\nThe following MCP servers are available: {mcp_names}."

    # Load task description and comment history for initial user message
    task = await pool.fetchrow(
        "SELECT title, description FROM \"Task\" WHERE id = $1",
        task_id,
    )
    if not task:
        raise ValueError(f"Task {task_id} not found")

    comments = await pool.fetch(
        """
        SELECT "authorType", content, "createdAt"
        FROM "TaskComment"
        WHERE "taskId" = $1
        ORDER BY "createdAt" ASC
        """,
        task_id,
    )

    # ── Sandbox setup ─────────────────────────────────────────────────────────
    sandbox = None
    if sandbox_provider == "e2b" and _E2B_AVAILABLE:
        # Resolve API key: workspace-stored key → env var fallback
        e2b_key = await _resolve_api_key(None, "e2b_sandbox", workspace_id, pool) or E2B_API_KEY
        if e2b_key:
            try:
                sandbox = await _AsyncSandbox.create(api_key=e2b_key, timeout=600)
                log.info("Run %s: E2B sandbox %s created.", run_log_id, sandbox.sandbox_id)
                tools = tools + SANDBOX_TOOLS
                system_prompt += (
                    "\n\n---\n## Sandbox Environment\n"
                    "You have access to a secure Ubuntu sandbox where you can execute shell commands, "
                    "write and read files, run build tools (cmake, make, cargo, npm, pip, git, etc.), "
                    "and commit/push code to GitHub.\n\n"
                    "**Coding workflow:**\n"
                    "1. Use `get_resource_key` to retrieve any tokens/credentials you need.\n"
                    "2. Use `run_shell` to clone the repository: "
                    "`git clone https://x-access-token:{token}@github.com/owner/repo /home/user/repo`\n"
                    "3. Write or edit files with `write_file` or `run_shell`.\n"
                    "4. Build and test with `run_shell`.\n"
                    "5. Commit and push: `git -C /home/user/repo add -A && git commit -m '...' && git push`\n"
                    "6. Call `complete_task` with a summary of what was done.\n\n"
                    "The sandbox is ephemeral — data does not persist after this run. "
                    "Always push to a remote repo before completing the task.\n"
                    "Working directory defaults to `/home/user`."
                )
            except Exception as e:
                log.warning("Run %s: Failed to create E2B sandbox: %s", run_log_id, e)
                sandbox = None
        else:
            log.warning("Run %s: sandbox_provider=e2b but no API key found.", run_log_id)

    ctx = ToolContext(
        task_id=task_id,
        project_id=project_id,
        project_agent_id=project_agent_id,
        workspace_id=workspace_id,
        sandbox=sandbox,
    )

    initial_message = (
        f"You have been assigned a task:\n\n"
        f"**{task['title']}**\n\n"
        f"{task['description'] or 'No description provided.'}\n\n"
        f"Please complete this task using the available tools."
    )

    if comments:
        history = "\n".join(
            f"[{'Human' if c['authorType'] == 'user' else 'Agent'}]: {c['content']}"
            for c in comments
        )
        initial_message += f"\n\n---\n**Comment history:**\n{history}\n\nTake the above comments into account — if a human has provided feedback or marked something as already done, act accordingly."

    # Mark task as IN_PROGRESS
    await pool.execute(
        'UPDATE "Task" SET status = \'IN_PROGRESS\'::"TaskStatus", "updatedAt" = NOW() WHERE id = $1',
        task_id,
    )
    await events.publish("task:updated", {"projectId": project_id, "task": {"id": task_id, "status": "IN_PROGRESS"}})

    # ── Wake/Resume: load saved conversation history if this is a resumed run ──
    saved_run = await pool.fetchrow(
        'SELECT messages, log, iterations, "totalInputTokens", "totalOutputTokens" FROM "AgentRunLog" WHERE id = $1',
        run_log_id,
    )
    if is_wake and saved_run and saved_run["messages"]:
        saved_messages = json.loads(saved_run["messages"]) if isinstance(saved_run["messages"], str) else saved_run["messages"]
    else:
        saved_messages = []

    if saved_messages:
        log.info("Run %s: waking from %d saved messages (iteration %d).", run_log_id, len(saved_messages), saved_run["iterations"])
        messages: list[dict] = saved_messages
        step_log: list[dict] = json.loads(saved_run["log"]) if isinstance(saved_run["log"], str) else list(saved_run["log"])
        iterations = saved_run["iterations"]
        total_input_tokens = saved_run["totalInputTokens"]
        total_output_tokens = saved_run["totalOutputTokens"]
    else:
        messages: list[dict] = [{"role": "user", "content": initial_message}]
        step_log: list[dict] = []
        iterations = 0
        total_input_tokens = 0
        total_output_tokens = 0

    final_status = "COMPLETED"

    try:
        while iterations < max_iterations:
            # Check stop signal
            run_row = await pool.fetchrow(
                "SELECT status FROM \"AgentRunLog\" WHERE id = $1", run_log_id
            )
            if run_row and run_row["status"] == "STOPPED":
                log.info("Run %s was stopped externally.", run_log_id)
                final_status = "STOPPED"
                break

            iterations += 1
            log.info("Run %s iteration %d/%d", run_log_id, iterations, max_iterations)

            response = await call_llm(
                provider=provider,
                model=model,
                api_key=api_key,
                system_prompt=system_prompt,
                messages=messages,
                tools=tools,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            input_tokens: int = response.get("input_tokens", 0)
            output_tokens: int = response.get("output_tokens", 0)
            total_input_tokens += input_tokens
            total_output_tokens += output_tokens

            step: dict = {
                "iteration": iterations,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "llm_content": response["content"],
                "tool_calls": [],
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "context_messages": len(messages),
            }

            if response["tool_calls"]:
                tool_results = []
                tools_by_name = {t["name"]: t for t in tools}
                for tc in response["tool_calls"]:
                    tool_def = tools_by_name.get(tc["name"])
                    result = await execute_tool(tc["name"], tc["arguments"], ctx, tool_def)
                    tool_results.append({"id": tc["id"], "name": tc["name"], "result": result})
                    logged_result = "[REDACTED]" if tc["name"] in SENSITIVE_TOOLS else result
                    step["tool_calls"].append({
                        "name": tc["name"],
                        "arguments": tc["arguments"],
                        "result": logged_result,
                    })
                    log.debug("Tool %s → %s", tc["name"], logged_result[:200])

                    # Stop after complete_task or block_task
                    if tc["name"] == "complete_task":
                        step_log.append(step)
                        final_status = "COMPLETED"
                        await _save_run_log(pool, run_log_id, iterations, final_status, step_log, total_input_tokens, total_output_tokens)
                        return
                    if tc["name"] == "block_task":
                        step_log.append(step)
                        final_status = "FAILED"
                        await _save_run_log(pool, run_log_id, iterations, final_status, step_log, total_input_tokens, total_output_tokens)
                        return

                # Append assistant + tool results to message history
                messages.append({
                    "role": "assistant",
                    "content": _build_assistant_content(response),
                })
                messages.append({
                    "role": "user",
                    "content": _build_tool_result_content(response["tool_calls"], tool_results),
                })
            else:
                # No tool calls — LLM is done
                messages.append({"role": "assistant", "content": response["content"] or ""})
                step_log.append(step)
                final_status = "COMPLETED"
                break

            step_log.append(step)

            # Flush log progress after every iteration so UI shows live progress + persist messages for wake/resume
            await _save_run_log(pool, run_log_id, iterations, "RUNNING", step_log, total_input_tokens, total_output_tokens, messages)

        else:
            final_status = "MAX_ITERATIONS"
            log.warning("Run %s hit max iterations (%d).", run_log_id, max_iterations)

    except Exception as exc:
        final_status = "FAILED"
        step_log.append({
            "iteration": iterations,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(exc),
        })
        log.exception("Run %s failed.", run_log_id)
        raise
    finally:
        await _save_run_log(pool, run_log_id, iterations, final_status, step_log, total_input_tokens, total_output_tokens)
        # Sync task status with run outcome
        try:
            if final_status == "COMPLETED":
                # Ensure task is DONE (idempotent if complete_task tool already set it)
                updated = await pool.fetchrow(
                    """
                    UPDATE "Task" SET status = 'DONE'::"TaskStatus", "updatedAt" = NOW()
                    WHERE id = $1 AND status != 'DONE'::"TaskStatus"
                    RETURNING id
                    """,
                    task_id,
                )
                if updated:
                    await events.publish("task:updated", {"projectId": project_id, "task": {"id": task_id, "status": "DONE"}})
            elif final_status in ("STOPPED", "FAILED", "MAX_ITERATIONS"):
                # Revert IN_PROGRESS back to TODO so the task can be retried.
                # STOPPED: user explicitly halted the run.
                # FAILED/MAX_ITERATIONS: unexpected error or iteration cap — task needs a retry.
                # Note: if block_task was called, the task is already BLOCKED (not IN_PROGRESS),
                # so the WHERE clause won't match and the task stays BLOCKED correctly.
                updated = await pool.fetchrow(
                    """
                    UPDATE "Task" SET status = 'TODO'::"TaskStatus", "updatedAt" = NOW()
                    WHERE id = $1 AND status = 'IN_PROGRESS'::"TaskStatus"
                    RETURNING id
                    """,
                    task_id,
                )
                if updated:
                    await events.publish("task:updated", {"projectId": project_id, "task": {"id": task_id, "status": "TODO"}})
        except Exception:
            log.exception("Failed to sync task status for run %s", run_log_id)
        # Destroy sandbox
        if sandbox:
            try:
                await sandbox.kill()
                log.info("Run %s: E2B sandbox destroyed.", run_log_id)
            except Exception:
                log.warning("Run %s: Failed to destroy E2B sandbox.", run_log_id)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _resolve_api_key(
    encrypted_agent_key: str | None,
    provider: str,
    workspace_id: str,
    pool,
) -> str:
    if encrypted_agent_key:
        return decrypt(encrypted_agent_key)
    row = await pool.fetchrow(
        """
        SELECT "encryptedKey"
        FROM "WorkspaceProviderKey"
        WHERE "workspaceId" = $1 AND provider = $2
        """,
        workspace_id,
        provider,
    )
    if row:
        return decrypt(row["encryptedKey"])
    raise ValueError(
        f"No API key configured for provider '{provider}' on workspace {workspace_id}"
    )


async def _save_run_log(
    pool, run_log_id: str, iterations: int, status: str, steps: list[dict],
    total_input_tokens: int = 0, total_output_tokens: int = 0,
    messages: list[dict] | None = None,
) -> None:
    await pool.execute(
        """
        UPDATE "AgentRunLog"
        SET status = $1::"AgentRunStatus",
            iterations = $2,
            log = $3::jsonb,
            "totalInputTokens" = $4,
            "totalOutputTokens" = $5,
            messages = $6::jsonb,
            "finishedAt" = CASE WHEN $1 != 'RUNNING' THEN NOW() ELSE "finishedAt" END
        WHERE id = $7
        """,
        status,
        iterations,
        json.dumps(steps),
        total_input_tokens,
        total_output_tokens,
        json.dumps(messages or []),
        run_log_id,
    )


def _build_assistant_content(response: dict) -> list[dict] | str:
    """Build Anthropic-style assistant message content with text + tool_use blocks."""
    blocks = []
    if response.get("content"):
        blocks.append({"type": "text", "text": response["content"]})
    for tc in response.get("tool_calls", []):
        blocks.append({
            "type": "tool_use",
            "id": tc["id"],
            "name": tc["name"],
            "input": tc["arguments"],
        })
    return blocks if blocks else response.get("content", "")


def _build_tool_result_content(tool_calls: list[dict], results: list[dict]) -> list[dict]:
    """Build Anthropic-style tool_result blocks for the user message."""
    return [
        {
            "type": "tool_result",
            "tool_use_id": tc["id"],
            "content": r["result"],
        }
        for tc, r in zip(tool_calls, results)
    ]
