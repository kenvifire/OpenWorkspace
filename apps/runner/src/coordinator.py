"""Coordinator agent consumer — reads coordinator-events stream and runs gating decisions."""
import asyncio
import logging

import redis.asyncio as aioredis

from src.config import (
    REDIS_HOST, REDIS_PORT, REDIS_PASSWORD,
    COORDINATOR_STREAM_NAME, COORDINATOR_GROUP, CONSUMER_NAME,
)
from src.database import get_pool
from src.llm import call_llm
from src.coordinator_tools import (
    COORDINATOR_TOOLS, CoordinatorContext, execute_coordinator_tool,
)
from src.processor import _resolve_api_key

log = logging.getLogger(__name__)

BLOCK_MS = 5000
CLAIM_INTERVAL_S = 60
CLAIM_IDLE_MS = 30_000

COORDINATOR_SYSTEM_PROMPT = """You are the project coordinator. Your job is to decide what happens next after a significant board event.

Rules:
1. Always call get_board_state first.
2. Make exactly one primary decision: proceed, hold, escalate, or abort.
3. You may combine escalate with proceed or hold in the same run.
4. State your reasoning in one sentence before acting.
5. When in doubt, hold and escalate rather than proceeding blind."""


async def run_coordinator_consumer() -> None:
    client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD)

    try:
        await client.xgroup_create(COORDINATOR_STREAM_NAME, COORDINATOR_GROUP, id="0", mkstream=True)
        log.info("Coordinator group '%s' created.", COORDINATOR_GROUP)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise
        log.info("Coordinator group '%s' already exists.", COORDINATOR_GROUP)

    claim_task = asyncio.create_task(_coordinator_claim_loop(client))
    try:
        await _coordinator_read_loop(client)
    finally:
        claim_task.cancel()
        await client.aclose()


async def _coordinator_read_loop(client: aioredis.Redis) -> None:
    log.info("Coordinator consumer listening on '%s'.", COORDINATOR_STREAM_NAME)
    while True:
        results = await client.xreadgroup(
            groupname=COORDINATOR_GROUP,
            consumername=CONSUMER_NAME,
            streams={COORDINATOR_STREAM_NAME: ">"},
            count=1,
            block=BLOCK_MS,
        )
        if not results:
            continue
        for _stream, messages in results:
            for msg_id, fields in messages:
                event = {k.decode(): v.decode() for k, v in fields.items()}
                log.info("Coordinator event %s: %s", msg_id.decode(), event)
                try:
                    await _process_coordinator_event(event)
                    await client.xack(COORDINATOR_STREAM_NAME, COORDINATOR_GROUP, msg_id)
                    log.info("Coordinator ACKed %s", msg_id.decode())
                except Exception:
                    log.exception("Coordinator event %s failed — leaving for retry", msg_id.decode())


async def _coordinator_claim_loop(client: aioredis.Redis) -> None:
    await asyncio.sleep(CLAIM_INTERVAL_S)
    while True:
        try:
            pending = await client.xpending_range(
                COORDINATOR_STREAM_NAME, COORDINATOR_GROUP, min="-", max="+", count=10
            )
            for entry in pending:
                msg_id = entry["message_id"]
                if entry.get("time_since_delivered", 0) >= CLAIM_IDLE_MS:
                    claimed = await client.xclaim(
                        COORDINATOR_STREAM_NAME, COORDINATOR_GROUP, CONSUMER_NAME, CLAIM_IDLE_MS, [msg_id]
                    )
                    if claimed:
                        for _mid, fields in claimed:
                            event = {k.decode(): v.decode() for k, v in fields.items()}
                            try:
                                await _process_coordinator_event(event)
                                await client.xack(COORDINATOR_STREAM_NAME, COORDINATOR_GROUP, _mid)
                            except Exception:
                                log.exception("Claimed coordinator event %s failed", _mid.decode())
        except Exception:
            log.exception("Error in coordinator claim loop")
        await asyncio.sleep(CLAIM_INTERVAL_S)


async def _process_coordinator_event(event: dict) -> None:
    project_id = event["projectId"]
    trigger_task_id = event["triggerTaskId"]
    trigger_event = event["triggerEvent"]
    coordinator_pa_id = event["coordinatorProjectAgentId"]

    pool = await get_pool()

    pa = await pool.fetchrow(
        """
        SELECT a."llmProvider", a."modelName", a."systemPrompt", a."encryptedApiKey",
               a.temperature, a."maxTokens", p."workspaceId"
        FROM "ProjectAgent" pa
        JOIN "Agent" a ON a.id = pa."agentId"
        JOIN "Project" p ON p.id = pa."projectId"
        WHERE pa.id = $1
        """,
        coordinator_pa_id,
    )
    if not pa:
        log.error("Coordinator ProjectAgent %s not found — ACKing to avoid infinite retry", coordinator_pa_id)
        return

    workspace_id = pa["workspaceId"]
    api_key = await _resolve_api_key(pa["encryptedApiKey"], pa["llmProvider"], workspace_id, pool)
    provider = pa["llmProvider"]
    model = pa["modelName"]
    system_prompt = pa["systemPrompt"] or COORDINATOR_SYSTEM_PROMPT
    temperature = pa["temperature"] if pa["temperature"] is not None else 0.3
    max_tokens = pa["maxTokens"] or 2048

    ctx = CoordinatorContext(
        project_id=project_id,
        trigger_task_id=trigger_task_id,
        trigger_event=trigger_event,
        coordinator_project_agent_id=coordinator_pa_id,
        workspace_id=workspace_id,
    )

    from src.tools import _new_id
    run_log_id = _new_id()
    try:
        await pool.execute(
            """
            INSERT INTO "AgentRunLog" (id, "taskId", "agentId", "projectAgentId", status, "startedAt")
            SELECT $1, $2, a.id, $3, 'RUNNING'::"AgentRunStatus", NOW()
            FROM "ProjectAgent" pa JOIN "Agent" a ON a.id = pa."agentId"
            WHERE pa.id = $3
            """,
            run_log_id, trigger_task_id, coordinator_pa_id,
        )
    except Exception:
        log.exception("Failed to create coordinator run log — continuing without log")
        run_log_id = None

    messages = [{"role": "user", "content": f"Coordinator event: {trigger_event} on task {trigger_task_id}. Survey the board and decide what to do next."}]

    try:
        for _ in range(10):
            response = await call_llm(
                provider=provider,
                model=model,
                api_key=api_key,
                system_prompt=system_prompt,
                messages=messages,
                tools=COORDINATOR_TOOLS,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            stop = False
            if response.get("tool_calls"):
                tool_results = []
                for tc in response["tool_calls"]:
                    result = await execute_coordinator_tool(tc["name"], tc.get("arguments", {}), ctx)
                    # Don't leak STOP control token into LLM context
                    llm_result = "Decision recorded." if isinstance(result, str) and result.startswith("STOP") else result
                    if isinstance(result, str) and result.startswith("STOP"):
                        stop = True
                    tool_results.append({"id": tc["id"], "name": tc["name"], "result": llm_result})
                # Build assistant + tool_result messages
                assistant_content = []
                if response.get("content"):
                    assistant_content.append({"type": "text", "text": response["content"]})
                for tc in response["tool_calls"]:
                    assistant_content.append({
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": tc["name"],
                        "input": tc.get("arguments", {}),
                    })
                messages.append({"role": "assistant", "content": assistant_content})
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": r["id"], "content": r["result"]}
                        for r in tool_results
                    ],
                })
                if stop:
                    break
            else:
                # No tool calls — end_turn
                stop = True

            if stop or response.get("stop_reason") == "end_turn":
                break

        if run_log_id:
            await pool.execute(
                """UPDATE "AgentRunLog" SET status = 'COMPLETED'::"AgentRunStatus", "finishedAt" = NOW() WHERE id = $1""",
                run_log_id,
            )
    except Exception:
        if run_log_id:
            await pool.execute(
                """UPDATE "AgentRunLog" SET status = 'FAILED'::"AgentRunStatus", "finishedAt" = NOW() WHERE id = $1""",
                run_log_id,
            )
        raise
