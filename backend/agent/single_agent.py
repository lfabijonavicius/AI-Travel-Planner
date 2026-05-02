"""Single-agent variant: one ReAct graph with all 11 tools and the unified prompt.

Feature-flagged via VOYAGER_AGENT_MODE=single. Production behaviour (flag unset)
is unchanged — RoutedGraph is returned by build_agent_graph() in graph.py.
"""
from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any

from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent

_PROMPT_PATH = Path(__file__).parent / "prompts" / "unified.md"


def build_single_agent(model: str | None = None) -> Any:
    """
    Build a one-agent ReAct graph with all 11 tools and the unified prompt.
    No router, no mode detection. Returns a compiled LangGraph identical in
    interface to RoutedGraph (same .astream_events signature) so the harness
    and main.py can swap them transparently.

    Tools are read from agent.graph module attributes at call time so that
    patch.multiple("agent.graph", ...) in the eval harness propagates into the
    compiled graph without requiring a separate patching step.
    """
    import agent.graph as _g  # late import — reads patched attrs if inside patch context

    tools = [
        _g.get_country_info,
        _g.search_flights,
        _g.search_hotels,
        _g.get_weather_forecast,
        _g.get_current_weather,
        _g.get_currency_exchange,
        _g.search_places,
        _g.calculate_budget,
        _g.generate_itinerary,
        _g.suggest_destinations,
        _g.get_city_pin,
    ]  # 11 tools, deduplicated

    prompt = _PROMPT_PATH.read_text().replace("{{CURRENT_DATE}}", datetime.date.today().isoformat())
    llm = _g._build_llm(enable_tool_calls=True)

    return create_react_agent(
        model=llm,
        tools=tools,
        prompt=SystemMessage(content=prompt),
        version="v2",
        name="single_agent",
    )
