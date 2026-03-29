"""Tests for src/tools.py — tool definitions and utilities."""
import sys
import types
import unittest.mock as mock

# ---------------------------------------------------------------------------
# Stub out heavy dependencies that tools.py imports at module level so the
# tests do not need a real database or Redis connection.
# ---------------------------------------------------------------------------

TEST_SECRET = "test-secret-32-characters-long!!"

# src.config
_fake_config = types.ModuleType("src.config")
_fake_config.ENCRYPTION_SECRET = TEST_SECRET  # type: ignore[attr-defined]
_fake_config.REDIS_HOST = "localhost"  # type: ignore[attr-defined]
_fake_config.REDIS_PORT = 6379  # type: ignore[attr-defined]
_fake_config.REDIS_PASSWORD = None  # type: ignore[attr-defined]
_fake_config.STREAM_NAME = "agent-runs"  # type: ignore[attr-defined]
sys.modules.setdefault("src.config", _fake_config)
sys.modules["src.config"].ENCRYPTION_SECRET = TEST_SECRET  # type: ignore[attr-defined]

# src.database — not needed for unit tests
_fake_db = types.ModuleType("src.database")
_fake_db.get_pool = mock.AsyncMock(return_value=None)  # type: ignore[attr-defined]
sys.modules.setdefault("src.database", _fake_db)

# src.events — not needed for unit tests
_fake_events = types.ModuleType("src.events")
_fake_events.publish = mock.AsyncMock()  # type: ignore[attr-defined]
sys.modules.setdefault("src.events", _fake_events)

# src.encryption — provide a stub so tools.py import resolves
_fake_enc = types.ModuleType("src.encryption")
_fake_enc.decrypt = lambda s: s  # type: ignore[attr-defined]
_fake_enc.encrypt = lambda s: s  # type: ignore[attr-defined]
sys.modules.setdefault("src.encryption", _fake_enc)

# Now safe to import
from src.tools import (  # noqa: E402
    _new_id,
    ToolContext,
    get_enabled_tools,
    ALL_TOOLS,
    SANDBOX_TOOLS,
    _truncate,
)

# ---------------------------------------------------------------------------
# Tests — _new_id
# ---------------------------------------------------------------------------

def test_new_id_returns_nonempty_string():
    result = _new_id()
    assert isinstance(result, str)
    assert len(result) > 0


def test_new_id_returns_unique_ids():
    id1 = _new_id()
    id2 = _new_id()
    assert id1 != id2


# ---------------------------------------------------------------------------
# Tests — ToolContext
# ---------------------------------------------------------------------------

def test_tool_context_creation():
    ctx = ToolContext(
        task_id="task-1",
        project_id="proj-1",
        project_agent_id="pa-1",
        workspace_id="ws-1",
    )
    assert ctx.task_id == "task-1"
    assert ctx.project_id == "proj-1"
    assert ctx.project_agent_id == "pa-1"
    assert ctx.workspace_id == "ws-1"


def test_tool_context_sandbox_none_by_default():
    ctx = ToolContext(
        task_id="task-1",
        project_id="proj-1",
        project_agent_id="pa-1",
        workspace_id="ws-1",
    )
    assert ctx.sandbox is None


# ---------------------------------------------------------------------------
# Tests — get_enabled_tools
# ---------------------------------------------------------------------------

def test_get_enabled_tools_all():
    result = get_enabled_tools([])
    assert result == ALL_TOOLS
    assert len(result) > 0


def test_get_enabled_tools_filtered():
    result = get_enabled_tools(["complete_task"])
    assert len(result) == 1
    assert result[0]["name"] == "complete_task"


def test_get_enabled_tools_unknown_name_excluded():
    result = get_enabled_tools(["nonexistent_tool"])
    assert result == []


# ---------------------------------------------------------------------------
# Tests — tool definition schemas
# ---------------------------------------------------------------------------

def test_sandbox_tools_have_required_fields():
    for tool in SANDBOX_TOOLS:
        assert "name" in tool, f"Missing 'name' in {tool}"
        assert "description" in tool, f"Missing 'description' in {tool}"
        assert "input_schema" in tool, f"Missing 'input_schema' in {tool}"


def test_all_tools_have_required_fields():
    for tool in ALL_TOOLS:
        assert "name" in tool, f"Missing 'name' in {tool}"
        assert "description" in tool, f"Missing 'description' in {tool}"
        assert "input_schema" in tool, f"Missing 'input_schema' in {tool}"


def test_all_tools_names_are_unique():
    names = [t["name"] for t in ALL_TOOLS]
    assert len(names) == len(set(names)), "Duplicate tool names found in ALL_TOOLS"


def test_sandbox_tools_names_are_unique():
    names = [t["name"] for t in SANDBOX_TOOLS]
    assert len(names) == len(set(names)), "Duplicate tool names found in SANDBOX_TOOLS"


# ---------------------------------------------------------------------------
# Tests — _truncate
# ---------------------------------------------------------------------------

def test_truncate_short_string():
    assert _truncate("hello") == "hello"


def test_truncate_long_string():
    long_str = "x" * 9000
    result = _truncate(long_str)
    assert len(result) < len(long_str)
    assert "chars truncated" in result


def test_truncate_exact_limit_not_truncated():
    exactly_8000 = "a" * 8000
    assert _truncate(exactly_8000) == exactly_8000


def test_truncate_preserves_start_and_end():
    content = "START" + ("m" * 8100) + "END"
    result = _truncate(content)
    assert result.startswith("START")
    assert result.endswith("END")
