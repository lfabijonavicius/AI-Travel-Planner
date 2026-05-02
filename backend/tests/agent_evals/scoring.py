"""Per-field extraction scoring logic."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

# Phrases the intake agent is expected to ask for each missing field.
_INTAKE_PHRASES: dict[str, list[str]] = {
    "start_date": ["when", "what dates", "which month", "what month", "travel date"],
    "end_date":   ["when", "what dates", "which month", "what month", "travel date"],
    "date_hint":  ["when", "what month", "which month", "travel date"],
    "party_size": ["how many", "who's travelling", "who is travelling", "number of"],
    "origin":     ["where are you flying from", "flying from", "where from", "departing from"],
    "budget_gbp": ["budget", "how much", "price range"],
}


@dataclass
class FieldResult:
    field: str
    passed: bool
    source: str  # "tool_args" | "text" | "intake_question" | "null_pass" | "failed"
    detail: str = ""


def _norm(v: Any) -> str:
    return str(v).strip().lower()


def _match_value(expected: Any, actual_str: str) -> bool:
    """Exact match for numbers, case-insensitive substring for strings."""
    if isinstance(expected, (int, float)):
        return str(int(expected)) in actual_str or str(expected) in actual_str
    return _norm(str(expected)) in actual_str.lower()


def _check_tool_args(
    field: str, expected: Any, tool_calls: list[dict[str, Any]]
) -> bool:
    for call in tool_calls:
        args = call.get("args", {})
        for arg_val in args.values():
            if _match_value(expected, str(arg_val)):
                return True
    return False


def _check_text(field: str, expected: Any, text: str) -> bool:
    """Word-boundary match for strings; substring match for numbers."""
    if isinstance(expected, (int, float)):
        return str(int(expected)) in text or str(expected) in text
    pattern = r"\b" + re.escape(str(expected)) + r"\b"
    return bool(re.search(pattern, text, re.IGNORECASE))


def _check_intake_question(field: str, text: str) -> bool:
    phrases = _INTAKE_PHRASES.get(field, [])
    lower = text.lower()
    return any(p in lower for p in phrases)


def score_extraction(
    must_extract: dict[str, Any],
    tool_calls: list[dict[str, Any]],
    agent_text: str,
    mode: str,
) -> dict[str, FieldResult]:
    results: dict[str, FieldResult] = {}

    for field, expected in must_extract.items():
        # null/None expected value → pass if agent also produced nothing (soft pass)
        if expected is None:
            results[field] = FieldResult(field, True, "null_pass")
            continue

        # (a) tool call args
        if _check_tool_args(field, expected, tool_calls):
            results[field] = FieldResult(field, True, "tool_args")
            continue

        # (b) word-boundary text match
        if _check_text(field, expected, agent_text):
            results[field] = FieldResult(field, True, "text")
            continue

        # (c) intake-question fallback (planner_intake mode only)
        if mode == "planner_intake" and _check_intake_question(field, agent_text):
            results[field] = FieldResult(
                field, True, "intake_question",
                detail=f"agent asked for {field}"
            )
            continue

        results[field] = FieldResult(
            field, False, "failed",
            detail=f"expected {expected!r}, not found in tool args or text"
        )

    return results
