"""Smoke tests for build_single_agent.

TDD: written before single_agent.py exists — first run fails on ImportError,
then passes after implementation.

Test 3 also verifies stub propagation: patch.multiple("agent.graph", ...) must
reach the tools wired into the compiled graph.
"""
from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# 1. Module-level import smoke
# ---------------------------------------------------------------------------

def test_build_single_agent_importable() -> None:
    from agent.single_agent import build_single_agent  # noqa: F401 — import is the test


# ---------------------------------------------------------------------------
# 2. Graph shape
# ---------------------------------------------------------------------------

def test_build_single_agent_returns_graph_with_astream_events() -> None:
    from agent.single_agent import build_single_agent
    g = build_single_agent()
    assert g is not None
    assert hasattr(g, "astream_events"), "compiled graph must expose astream_events"


# ---------------------------------------------------------------------------
# 3. Stub propagation — patch agent.graph, build agent, confirm stub is wired
# ---------------------------------------------------------------------------

def test_stub_propagation_via_agent_graph_patch() -> None:
    """
    patch.multiple("agent.graph", get_current_weather=stub) must propagate into
    the tools list that build_single_agent() wires, because it reads tools from
    agent.graph module attributes at call time.
    """
    from agent.single_agent import build_single_agent
    from langchain_core.tools import StructuredTool
    import agent.graph as _g

    stub = StructuredTool.from_function(
        func=lambda **kw: {"city": "test", "temp_c": 0.0},
        name="get_current_weather",
        description="stub",
        args_schema=getattr(_g.get_current_weather, "args_schema", None),
    )

    captured: list = []
    original_create = None

    def capturing_create(model, tools, **kw):
        captured.extend(tools)
        return original_create(model, tools, **kw)  # type: ignore[misc]

    import langgraph.prebuilt as _lp
    original_create = _lp.create_react_agent

    with patch.multiple("agent.graph", get_current_weather=stub):
        with patch("agent.single_agent.create_react_agent", side_effect=capturing_create):
            build_single_agent()

    weather_tools = [t for t in captured if t.name == "get_current_weather"]
    assert weather_tools, "get_current_weather must be wired into single agent"
    assert weather_tools[0] is stub, (
        "stub from patch.multiple('agent.graph') must be the tool wired in — "
        "not the real tool. Import strategy is broken if this fails."
    )


# ---------------------------------------------------------------------------
# 4. Real invocation (slow — makes an LLM call)
# ---------------------------------------------------------------------------

@pytest.mark.slow
def test_single_agent_responds_to_trivial_message() -> None:
    from agent.single_agent import build_single_agent

    g = build_single_agent()
    state = {
        "messages": [("user", "hello")],
        "trip_context": {}, "tool_results": {}, "itinerary": None,
    }

    async def _run() -> str:
        parts: list[str] = []
        async for event in g.astream_events(state, version="v2", config={"recursion_limit": 10}):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"].content
                if chunk:
                    parts.append(chunk)
        return "".join(parts)

    text = asyncio.run(_run())
    assert len(text) > 0, "single agent returned empty response"
