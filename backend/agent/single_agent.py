"""Single-agent variant: one ReAct graph with all 11 tools and the unified prompt.

ReAct (Reason + Act) is a prompting pattern where the LLM loops:
  Thought → Tool call → Observation → Thought → … → Final answer
LangGraph compiles this loop into a graph so it can be streamed and traced.
"""
from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any

from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent

_PROMPT_PATH = Path(__file__).parent / "prompts" / "unified.md"


def build_single_agent(model: str | None = None) -> Any:
    """Build a compiled LangGraph ReAct agent with all 11 tools and the system prompt."""
    # Late import so unit tests can monkey-patch agent.graph tools before the graph is compiled
    import agent.graph as _g

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

    # Inject today's date into the system prompt so the model knows the current date
    prompt = _PROMPT_PATH.read_text().replace("{{CURRENT_DATE}}", datetime.date.today().isoformat())
    llm = _g._build_llm(enable_tool_calls=True)

    # create_react_agent wires up the Thought→Tool→Observation loop automatically
    return create_react_agent(
        model=llm,
        tools=tools,
        prompt=SystemMessage(content=prompt),
        version="v2",
        name="single_agent",
    )
