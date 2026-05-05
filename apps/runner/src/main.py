"""Entry point for the agent runner service."""
import asyncio
import logging
import signal
import sys
from dotenv import load_dotenv
load_dotenv()

try:
    import uvloop
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
except ImportError:
    pass  # Windows / uvloop not installed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)


async def _cleanup_stale_runs() -> None:
    """Mark any RUNNING AgentRunLogs as FAILED on startup and revert their tasks to TODO."""
    from src.database import get_pool
    pool = await get_pool()

    # Atomically mark stale runs as FAILED and capture the affected task IDs
    stale = await pool.fetch(
        """
        UPDATE "AgentRunLog"
        SET status = 'FAILED'::"AgentRunStatus", "finishedAt" = NOW()
        WHERE status = 'RUNNING'
        RETURNING "taskId"
        """
    )
    if not stale:
        return

    task_ids = [r["taskId"] for r in stale]
    log.warning("Cleaned up %d stale RUNNING agent run(s) on startup.", len(task_ids))

    # Revert any tasks that are still IN_PROGRESS back to TODO so they appear
    # in the correct lane and can be re-triggered manually or via the next event.
    reverted = await pool.execute(
        """
        UPDATE "Task"
        SET status = 'TODO'::"TaskStatus", "updatedAt" = NOW()
        WHERE id = ANY($1::text[])
          AND status = 'IN_PROGRESS'::"TaskStatus"
        """,
        task_ids,
    )
    reverted_count = int(reverted.split()[-1]) if reverted else 0
    if reverted_count:
        log.warning("Reverted %d IN_PROGRESS task(s) to TODO after stale-run cleanup.", reverted_count)


async def _main() -> None:
    from src.database import close_pool
    from src import events
    from src.processor import run_consumer

    await _cleanup_stale_runs()

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _handle_signal() -> None:
        log.info("Shutdown signal received.")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    consumer_task = asyncio.create_task(run_consumer())

    await stop_event.wait()
    log.info("Stopping runner…")
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass

    await close_pool()
    await events.close()
    log.info("Runner stopped.")


if __name__ == "__main__":
    asyncio.run(_main())
