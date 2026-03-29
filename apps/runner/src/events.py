"""Redis pub/sub publisher for Kanban events."""
import json
import redis.asyncio as aioredis
from src.config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, KANBAN_CHANNEL

_client: aioredis.Redis | None = None


def _get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD)
    return _client


async def publish(event: str, payload: dict) -> None:
    client = _get_client()
    message = json.dumps({"event": event, "payload": payload})
    await client.publish(KANBAN_CHANNEL, message)


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
