import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]
REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD: str | None = os.getenv("REDIS_PASSWORD") or None
ENCRYPTION_SECRET: str = os.environ["ENCRYPTION_SECRET"]

STREAM_NAME = "agent-runs"
CONSUMER_GROUP = "runner-group"
CONSUMER_NAME = os.getenv("RUNNER_INSTANCE", "runner-1")
KANBAN_CHANNEL = "kanban:events"

E2B_API_KEY: str | None = os.getenv("E2B_API_KEY") or None
