"""LLM provider caller — OpenAI, Anthropic, Gemini via httpx."""
import json
import httpx
from typing import Any

TIMEOUT = httpx.Timeout(120.0)


async def call_llm(
    provider: str,
    model: str,
    api_key: str,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """Call the LLM and return a normalized response dict.

    Returns:
        {
            "content": str | None,
            "tool_calls": [{"name": str, "arguments": dict, "id": str}],
            "stop_reason": "tool_use" | "end_turn" | "stop",
        }
    """
    if provider == "openai":
        return await _call_openai(model, api_key, system_prompt, messages, tools, temperature, max_tokens)
    elif provider == "anthropic":
        return await _call_anthropic(model, api_key, system_prompt, messages, tools, temperature, max_tokens)
    elif provider == "gemini":
        return await _call_gemini(model, api_key, system_prompt, messages, tools, temperature, max_tokens)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------

def _openai_tools(tools: list[dict]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", {}),
            },
        }
        for t in tools
    ]


def _to_openai_messages(messages: list[dict]) -> list[dict]:
    """Convert Anthropic-style message history (tool_use/tool_result blocks) to OpenAI format."""
    result = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]

        if isinstance(content, str):
            result.append({"role": role, "content": content})
            continue

        if not isinstance(content, list):
            result.append(msg)
            continue

        if role == "assistant":
            text = None
            tool_calls = []
            for block in content:
                if block.get("type") == "text":
                    text = block["text"]
                elif block.get("type") == "tool_use":
                    tool_calls.append({
                        "id": block["id"],
                        "type": "function",
                        "function": {
                            "name": block["name"],
                            "arguments": json.dumps(block.get("input", {})),
                        },
                    })
            out: dict[str, Any] = {"role": "assistant", "content": text}
            if tool_calls:
                out["tool_calls"] = tool_calls
            result.append(out)

        elif role == "user":
            for block in content:
                if block.get("type") == "tool_result":
                    result.append({
                        "role": "tool",
                        "tool_call_id": block.get("tool_use_id", ""),
                        "content": block.get("content", ""),
                    })
                elif block.get("type") == "text":
                    result.append({"role": "user", "content": block["text"]})

    return result


async def _call_openai(
    model: str,
    api_key: str,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    temperature: float,
    max_tokens: int,
) -> dict:
    openai_messages = [{"role": "system", "content": system_prompt}] + _to_openai_messages(messages)
    body: dict[str, Any] = {
        "model": model,
        "messages": openai_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        body["tools"] = _openai_tools(tools)
        body["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    choice = data["choices"][0]
    msg = choice["message"]
    finish = choice["finish_reason"]

    tool_calls = []
    if msg.get("tool_calls"):
        for tc in msg["tool_calls"]:
            tool_calls.append({
                "id": tc["id"],
                "name": tc["function"]["name"],
                "arguments": json.loads(tc["function"]["arguments"]),
            })

    usage = data.get("usage", {})
    return {
        "content": msg.get("content"),
        "tool_calls": tool_calls,
        "stop_reason": "tool_use" if finish == "tool_calls" else "end_turn",
        "input_tokens": usage.get("prompt_tokens", 0),
        "output_tokens": usage.get("completion_tokens", 0),
    }


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------

def _anthropic_tools(tools: list[dict]) -> list[dict]:
    return [
        {
            "name": t["name"],
            "description": t.get("description", ""),
            "input_schema": t.get("input_schema", {"type": "object", "properties": {}}),
        }
        for t in tools
    ]


async def _call_anthropic(
    model: str,
    api_key: str,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    temperature: float,
    max_tokens: int,
) -> dict:
    body: dict[str, Any] = {
        "model": model,
        "system": system_prompt,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        body["tools"] = _anthropic_tools(tools)

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    stop_reason = data.get("stop_reason", "end_turn")
    content_blocks = data.get("content", [])

    text_content = None
    tool_calls = []
    for block in content_blocks:
        if block["type"] == "text":
            text_content = block["text"]
        elif block["type"] == "tool_use":
            tool_calls.append({
                "id": block["id"],
                "name": block["name"],
                "arguments": block.get("input", {}),
            })

    usage = data.get("usage", {})
    return {
        "content": text_content,
        "tool_calls": tool_calls,
        "stop_reason": "tool_use" if stop_reason == "tool_use" else "end_turn",
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
    }


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------

def _gemini_tools(tools: list[dict]) -> list[dict]:
    function_declarations = [
        {
            "name": t["name"],
            "description": t.get("description", ""),
            "parameters": t.get("input_schema", {}),
        }
        for t in tools
    ]
    return [{"functionDeclarations": function_declarations}]


def _to_gemini_messages(messages: list[dict]) -> list[dict]:
    result = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        if isinstance(m["content"], str):
            result.append({"role": role, "parts": [{"text": m["content"]}]})
        elif isinstance(m["content"], list):
            parts = []
            for block in m["content"]:
                if block.get("type") == "text":
                    parts.append({"text": block["text"]})
                elif block.get("type") == "tool_result":
                    parts.append({
                        "functionResponse": {
                            "name": block.get("tool_use_id", ""),
                            "response": {"result": block.get("content", "")},
                        }
                    })
                elif block.get("type") == "tool_use":
                    parts.append({
                        "functionCall": {
                            "name": block["name"],
                            "args": block.get("input", {}),
                        }
                    })
            result.append({"role": role, "parts": parts})
    return result


async def _call_gemini(
    model: str,
    api_key: str,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    temperature: float,
    max_tokens: int,
) -> dict:
    gemini_messages = _to_gemini_messages(messages)
    body: dict[str, Any] = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": gemini_messages,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    if tools:
        body["tools"] = _gemini_tools(tools)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()

    candidate = data["candidates"][0]
    finish = candidate.get("finishReason", "STOP")
    parts = candidate["content"].get("parts", [])

    text_content = None
    tool_calls = []
    for part in parts:
        if "text" in part:
            text_content = part["text"]
        elif "functionCall" in part:
            fc = part["functionCall"]
            tool_calls.append({
                "id": fc["name"],  # Gemini has no call ID; use name
                "name": fc["name"],
                "arguments": fc.get("args", {}),
            })

    usage_meta = data.get("usageMetadata", {})
    return {
        "content": text_content,
        "tool_calls": tool_calls,
        "stop_reason": "tool_use" if finish == "OTHER" and tool_calls else "end_turn",
        "input_tokens": usage_meta.get("promptTokenCount", 0),
        "output_tokens": usage_meta.get("candidatesTokenCount", 0),
    }
