"""Eval runner for the Voyager single agent.

Usage:
    python -m backend.tests.agent_evals.runner
    pytest backend/tests/agent_evals/
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[2]))  # backend/ on path for CLI

from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
import pytest

from config import settings
from tests.agent_evals.fixtures import FIXTURES, Fixture
from tests.agent_evals.scoring import FieldResult, score_extraction

# ---------------------------------------------------------------------------
# Canned responses — pinned literals, same output every run
# ---------------------------------------------------------------------------
_CANNED: dict[str, Any] = {
    "search_flights": [{"airline": "BA", "flight_number": "BA492", "route": "LON-LIS",
        "departure_date": "2026-05-12", "return_date": "2026-05-17", "price_gbp": 178, "stops": 0}],
    "search_hotels": [{"name": "Hotel Lisboa Plaza", "city": "Lisbon",
        "price_per_night_gbp": 115, "total_price_gbp": 575, "rating": 8.4}],
    "get_weather_forecast": [{"date": "2026-05-12", "temp_high_c": 23, "temp_low_c": 14,
        "precipitation_probability": 12, "condition": "Sunny", "weather_icon": "☀️"}],
    "get_current_weather": {"city": "Rome", "temp_c": 21.0, "condition": "Clear Sky", "humidity_pct": 45},
    "get_currency_exchange": {"base": "GBP", "target": "EUR", "rate": 1.17},
    "search_places": [{"name": "Belém Tower", "category": "landmarks", "lat": 38.6916, "lng": -9.2159, "rating": 9.1}],
    "calculate_budget": {"total_gbp": 1528, "per_person_gbp": 764, "within_budget": True, "over_by_gbp": 0},
    "generate_itinerary": {"__done": True, "destination": "Lisbon", "start": "2026-05-12",
        "end": "2026-05-17", "days": [{"day": 1, "activities": ["Arrive and explore Baixa"]}]},
    "suggest_destinations": [{"name": "Lisbon", "country": "Portugal", "vibe": "Historic city, warm sun"},
        {"name": "Seville", "country": "Spain", "vibe": "Flamenco, tapas, grand architecture"}],
    "get_city_pin": {"city": "Lisbon", "lat": 38.7169, "lng": -9.1399},
}
_IN_CPM = 0.40   # cost per 1M input tokens (gpt-4.1-mini)
_OUT_CPM = 1.60


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------
@dataclass
class FixtureResult:
    name: str
    passed: bool           # tools + extraction
    behavioral_pass: bool  # same as passed (kept for reporting compat)
    tools_match: bool
    extraction_match: bool
    actual_tools: list[str]
    actual_extraction: dict[str, str]   # field -> source label
    field_results: dict[str, FieldResult]
    notes: list[str]


@dataclass
class EvalReport:
    results: list[FixtureResult]
    pass_count: int           # strict passes
    behavioral_pass_count: int
    fail_count: int
    elapsed_seconds: float
    estimated_cost_usd: float


# ---------------------------------------------------------------------------
# Tool recorder + stub factory
# ---------------------------------------------------------------------------
class _ToolRecorder:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def reset(self) -> None:
        self.calls.clear()

    def make_stub(self, tool: Any) -> Any:
        canned, rec = _CANNED.get(tool.name, {}), self
        if tool.name == "get_country_info":
            def _fn(**kw: Any) -> Any:
                rec.calls.append({"name": tool.name, "args": dict(kw)})
                country = kw.get("country", "Unknown")
                return {
                    "name": country,
                    "capital": "Stub Capital",
                    "region": "Stub Region",
                    "visa_required_uk": False,
                    "currency": "EUR",
                    "languages": ["English"],
                    "currencies": [{"code": "GBP", "name": "Pound", "symbol": "£"}],
                }
        else:
            def _fn(**kw: Any) -> Any:
                rec.calls.append({"name": tool.name, "args": dict(kw)})
                return canned
        return StructuredTool.from_function(
            func=_fn, name=tool.name, description=tool.description,
            args_schema=getattr(tool, "args_schema", None),
        )


def _eval_llm(*, enable_tool_calls: bool) -> Any:
    llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0, seed=0, streaming=True,
                     openai_api_key=settings.openai_api_key)
    return llm.bind(parallel_tool_calls=False) if enable_tool_calls else llm


def _build_eval_graph(recorder: _ToolRecorder, variant: str = "single") -> Any:
    from agent.tools import (calculate_budget, generate_itinerary, get_city_pin,
        get_country_info, get_currency_exchange, get_current_weather,
        get_weather_forecast, search_flights, search_hotels,
        search_places, suggest_destinations)
    real = [calculate_budget, generate_itinerary, get_city_pin, get_country_info,
            get_currency_exchange, get_current_weather, get_weather_forecast,
            search_flights, search_hotels, search_places, suggest_destinations]
    attrs = {t.name: recorder.make_stub(t) for t in real}
    attrs["_build_llm"] = _eval_llm
    with patch.multiple("agent.graph", **attrs):
        from agent.single_agent import build_single_agent
        return build_single_agent()


# ---------------------------------------------------------------------------
# Per-fixture runner
# ---------------------------------------------------------------------------
async def _run_one(
    fx: Fixture, graph: Any, rec: _ToolRecorder, variant: str = "single"
) -> tuple[FixtureResult, str, float]:
    state: dict[str, Any] = {
        "messages": [(m["role"], m["content"]) for m in fx["messages"]],
        "trip_context": {}, "tool_results": {}, "itinerary": None,
    }
    rec.reset()
    text_parts: list[str] = []
    in_tok = out_tok = 0

    async for event in graph.astream_events(state, version="v2", config={"recursion_limit": 25}):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"].content
            if chunk:
                text_parts.append(chunk)
        elif event["event"] == "on_chat_model_end":
            usage = getattr(event["data"].get("output"), "usage_metadata", None)
            if usage:
                in_tok += usage.get("input_tokens", 0) or 0
                out_tok += usage.get("output_tokens", 0) or 0

    agent_text = "".join(text_parts)
    tool_calls = list(rec.calls)
    actual_tools = [c["name"] for c in tool_calls]

    exp_sets = fx["expected_tools_any_of"]
    if not exp_sets or exp_sets == [[]]:
        tools_match = actual_tools == []
    else:
        tools_match = any(set(actual_tools) == set(s) for s in exp_sets)

    fld = score_extraction(fx["must_extract"], tool_calls, agent_text, fx["expected_mode"])
    extraction_match = all(r.passed for r in fld.values())

    behavioral_pass = tools_match and extraction_match

    notes: list[str] = []
    if not tools_match:
        notes.append(f"expected tools (any of): {exp_sets}")
        notes.append(f"actual tools:            {actual_tools}")
    for fname, fr in fld.items():
        if not fr.passed:
            notes.append(f"extraction miss: {fname} — {fr.detail}")

    cost = (in_tok * _IN_CPM + out_tok * _OUT_CPM) / 1_000_000
    return FixtureResult(
        name=fx["name"], passed=behavioral_pass, behavioral_pass=behavioral_pass,
        tools_match=tools_match, extraction_match=extraction_match,
        actual_tools=actual_tools,
        actual_extraction={k: v.source for k, v in fld.items()},
        field_results=fld, notes=notes,
    ), agent_text, cost


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def run_evals(fixtures: list[Fixture] = FIXTURES, variant: str = "router") -> EvalReport:
    rec = _ToolRecorder()
    graph = _build_eval_graph(rec, variant=variant)
    results: list[FixtureResult] = []
    total_cost = 0.0
    trace_subdir = "single" if variant == "single" else "router"
    trace_dir = Path(__file__).parent / ".last_run" / trace_subdir
    t0 = time.monotonic()

    async def _all() -> None:
        nonlocal total_cost
        for fx in fixtures:
            result, agent_text, cost = await _run_one(fx, graph, rec, variant=variant)
            results.append(result)
            total_cost += cost
            if not result.behavioral_pass:
                trace_dir.mkdir(parents=True, exist_ok=True)
                trace = {"fixture": fx["name"], "input_messages": fx["messages"],
                         "tool_calls": list(rec.calls), "agent_text": agent_text}
                (trace_dir / f"{fx['name']}.json").write_text(json.dumps(trace, indent=2, default=str))

    asyncio.run(_all())
    elapsed = round(time.monotonic() - t0, 1)
    strict_passed = sum(1 for r in results if r.passed)
    behavioral_passed = sum(1 for r in results if r.behavioral_pass)
    return EvalReport(
        results=results,
        pass_count=strict_passed,
        behavioral_pass_count=behavioral_passed,
        fail_count=len(results) - behavioral_passed,
        elapsed_seconds=elapsed,
        estimated_cost_usd=round(total_cost, 4),
    )


# ---------------------------------------------------------------------------
# CLI + pytest
# ---------------------------------------------------------------------------
_G, _R, _Z = "\033[32m", "\033[31m", "\033[0m"
_N = len(FIXTURES)


def _print_report(report: EvalReport) -> None:
    failures = [r.name for r in report.results if not r.behavioral_pass]
    print("\nSingle agent")
    for r in report.results:
        icon = f"{_G}✓{_Z}" if r.behavioral_pass else f"{_R}✗{_Z}"
        print(f"  {icon} {r.name}")
        for note in r.notes:
            print(f"      {note}")
    b = _G if report.behavioral_pass_count == _N else _R
    print(f"  Behavioral pass: {b}{report.behavioral_pass_count}/{_N}{_Z}  (tools + extraction)")
    if failures:
        print(f"  Failures: {failures}")


def main() -> None:
    argparse.ArgumentParser(description="Voyager agent eval runner").parse_args()
    report = run_evals()
    _print_report(report)
    print(f"\n  est. cost: ${report.estimated_cost_usd:.4f}  time: {report.elapsed_seconds:.1f}s")


@pytest.mark.slow
def test_all_fixtures_behavioral() -> None:
    report = run_evals()
    failures = [r.name for r in report.results if not r.behavioral_pass]
    assert len(report.results) == _N, f"Expected {_N} results, got {len(report.results)}"
    print(f"\nBehavioral pass: {report.behavioral_pass_count}/{_N}  failures: {failures}")


if __name__ == "__main__":
    main()
