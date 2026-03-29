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
    """Mark any RUNNING AgentRunLogs as FAILED on startup — their stream messages are gone."""
    from src.database import get_pool
    pool = await get_pool()
    result = await pool.execute(
        """
        UPDATE "AgentRunLog"
        SET status = 'FAILED'::"AgentRunStatus",
            "finishedAt" = NOW()
        WHERE status = 'RUNNING'
        """
    )
    count = int(result.split()[-1]) if result else 0
    if count:
        log.warning("Cleaned up %d stale RUNNING agent run(s) on startup.", count)


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
