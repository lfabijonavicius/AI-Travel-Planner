# Instructions: Build the Voyager agent eval harness

> Paste this into a fresh Claude Code session in the Voyager repo. Do not modify it before sending.

---

## Problem

Voyager's agent has 6 modes routed by 227 lines of regex in `backend/agent/graph.py::_detect_mode`. We don't know which routing decisions are correct because we have no test fixtures — every refactor is judged by vibes in the UI. Before we change the router (e.g. swap regex for an LLM classifier, or collapse to one agent), we need an automated eval that turns "is this better?" into a number.

## Solution

Build a small, runnable eval harness that:

1. Loads a fixture file of representative conversations + expected behaviour.
2. Runs each conversation through the existing agent.
3. Scores each fixture on three axes: routed mode, tools called, and key entities extracted.
4. Prints a pass/fail summary and a per-fixture diff for failures.
5. Runs in under 60 seconds for 10 fixtures and costs under $0.20 per full run.

This is a vertical tracer-bullet slice — it touches fixtures, runner, and integration with the existing graph. End state is `pytest backend/tests/agent_evals/` printing a green/red summary.

## Out of scope

- Do not refactor the router. Do not collapse agents. Do not change `_detect_mode`.
- Do not add the LLM classifier yet. This eval is the prerequisite, not part of the change.
- Do not delete the regex router. We need it as the baseline to score against.
- Do not add a CI step. Local-only for now.
- Do not build a UI for results. CLI output only.

---

## File plan

Create exactly these files. Nothing else.

```
backend/tests/__init__.py                       # empty
backend/tests/agent_evals/__init__.py           # empty
backend/tests/agent_evals/fixtures.py           # the 10 conversations + expected output
backend/tests/agent_evals/runner.py             # scoring logic + CLI entry point
backend/tests/agent_evals/README.md             # 20 lines: how to add a fixture, how to run
```

If any of those paths already exist, stop and ask the user before overwriting.

---

## `fixtures.py` — exact shape

A single module-level constant `FIXTURES: list[Fixture]`. Define `Fixture` as a `TypedDict` (or `dataclass`) with these keys:

```python
class Fixture(TypedDict):
    name: str                              # snake_case, unique, descriptive
    messages: list[dict]                   # [{"role": "user"|"assistant", "content": str}, ...]
    expected_mode: str                     # one of the 6 modes in graph.py
    expected_tools_any_of: list[list[str]] # each inner list = an acceptable tool-call set
    must_extract: dict[str, object]        # entities the agent should pick up (party_size, dates, origin, etc.)
```

`expected_tools_any_of` is a list of *alternative* acceptable tool-call sets — e.g. `[["search_flights", "search_hotels"], ["search_flights", "search_hotels", "get_weather_forecast"]]` means either set passes. This is critical: AI agents legitimately differ on whether to fetch weather alongside flights, and we shouldn't fail a fixture for a defensible variation.

Fill `FIXTURES` with these 10 conversations. Names are mandatory; phrasing is mandatory.

1. **`fully_specified_plan`** — `"plan a 5-day trip to lisbon for 2 adults from london, may 12-17, budget £2000"` → mode `planner`, tools `[search_flights, search_hotels]` or `[search_flights, search_hotels, get_weather_forecast]`, extract `{party_size: 2, origin: "London", destination: "Lisbon", start_date: "2026-05-12", end_date: "2026-05-17", budget_gbp: 2000}`.

2. **`vague_discovery_partner`** — `"my partner and i want to go somewhere romantic in late spring"` → mode `discovery`, tools `[]` or `[suggest_destinations]`, extract `{party_size: 2, date_hint: "late spring"}`.

3. **`partial_intake_no_dates`** — `"i want to go to tokyo from london, two of us"` → mode `planner_intake`, tools `[]`, extract `{party_size: 2, origin: "London", destination: "Tokyo"}`. Agent should ask one clarifying question about dates.

4. **`flight_only_lookup`** — `"what flights are there from london to barcelona on june 3?"` → mode `flight_lookup`, tools `[search_flights]`, extract `{origin: "London", destination: "Barcelona", start_date: "2026-06-03"}`.

5. **`place_only_lookup`** — `"any good ramen near shibuya station?"` → mode `place_lookup`, tools `[search_places]`, extract `{destination: "Tokyo"}` or `{destination: "Shibuya"}`.

6. **`country_info_lookup`** — `"do i need a visa for vietnam as a british citizen?"` → mode `info`, tools `[get_country_info]`, extract `{destination: "Vietnam"}`.

7. **`weather_lookup`** — `"what's the weather like in rome next week?"` → mode `info`, tools `[get_weather_forecast]`, extract `{destination: "Rome"}`.

8. **`mid_conversation_pivot`** — two-turn fixture. Turn 1 user: `"thinking about iceland in december"`. Turn 2 assistant (canned): `"How many people travelling and where from?"`. Turn 3 user: `"two of us from manchester, budget around £1500"`. → mode `planner` on the final turn, tools `[search_flights, search_hotels]`, extract `{destination: "Iceland", party_size: 2, origin: "Manchester", budget_gbp: 1500, date_hint: "December"}`.

9. **`ambiguous_followup`** — two-turn fixture. Turn 1 user: `"can you suggest somewhere warm in february?"`. Turn 2 assistant (canned): `"What's your budget and where are you flying from?"`. Turn 3 user: `"london, around £1000pp"`. → mode `discovery`, tools `[]` or `[suggest_destinations]`, extract `{origin: "London", budget_gbp: 1000, party_size: null, date_hint: "February"}`.

10. **`out_of_scope_question`** — `"what's the capital of france?"` → mode `info`, tools `[get_country_info]` or `[]`, extract `{destination: "France"}`. The agent must not call `search_flights` or `generate_itinerary`.

These ten cover: full spec, discovery, partial intake, three lookup types, multi-turn context, ambiguous followup, and a defensive case. Do not add or remove fixtures in this pass — 10 is the deliverable.

---

## `runner.py` — exact shape

Single public function: `run_evals(fixtures: list[Fixture] = FIXTURES) -> EvalReport`.

```python
@dataclass
class FixtureResult:
    name: str
    passed: bool
    mode_match: bool
    tools_match: bool
    extraction_match: bool
    actual_mode: str
    actual_tools: list[str]
    actual_extraction: dict
    notes: list[str]

@dataclass
class EvalReport:
    results: list[FixtureResult]
    pass_count: int
    fail_count: int
    elapsed_seconds: float
    estimated_cost_usd: float
```

Internals:

- For each fixture, build a `state` dict matching what `RoutedGraph` expects, feed `messages` in, run the graph, and capture: which mode `_detect_mode` returned, which tools were actually invoked, and which entities ended up in the agent's structured output.
- Use the existing graph as-is; do not bypass `_detect_mode`. We're testing it, not replacing it.
- Tool capture: wrap each tool with a recorder that appends its name to a list. Do not actually hit external APIs — use `monkeypatch` / dependency injection / a `RECORD_ONLY=true` env var to short-circuit tools to a stub return. The point is to verify *which* tools the agent chose, not what they returned.
- Extraction capture: read the trip-context fields the agent produced (the same shape that gets sent to the frontend). Compare against `must_extract` with a soft match — exact match for IDs and numbers, case-insensitive substring match for city/country names, and treat `null`/missing as a non-failure if the fixture also says null.

CLI entry point at the bottom: `if __name__ == "__main__": main()` where `main()` calls `run_evals()` and prints a coloured summary like:

```
✓ fully_specified_plan
✓ vague_discovery_partner
✗ partial_intake_no_dates
    expected mode: planner_intake
    actual mode:   planner
    missing extraction: party_size=2 (got party_size=None)

8/10 passed in 42.1s — est. $0.07
```

Pytest integration: also expose a `test_all_fixtures_pass` function that calls `run_evals()` and asserts `report.fail_count == 0` so `pytest backend/tests/agent_evals/` works out of the box. It's fine for it to be slow; mark it with `@pytest.mark.slow` if pytest config supports markers.

---

## `README.md` — exact shape

20 lines max. Cover: what the harness is, how to run it (`python -m backend.tests.agent_evals.runner` and `pytest backend/tests/agent_evals/`), how to add a fixture (one paragraph pointing at the `Fixture` TypedDict), and the rule that fixtures must be deterministic — no live API calls, no time-dependent dates that drift.

---

## Implementation rules

- **Test-first.** Before writing `runner.py`, write `backend/tests/agent_evals/test_runner_smoke.py` with a single test that constructs a `Fixture` with one trivial message and asserts the runner returns a `FixtureResult`. Make it fail. Make it pass. Then build the rest.
- **No new dependencies** unless absolutely required. The repo already has pytest, pydantic, and the graph machinery — use those.
- **No edits to `backend/agent/graph.py`** beyond exposing `_detect_mode` if it's currently private. Even that, do as a single one-line change with a comment.
- **No edits to `backend/main.py`.** The harness is independent of the FastAPI app.
- **No edits to existing CLAUDE.md files.** Don't touch them in this task.
- Keep `runner.py` under 250 lines. If you're past 200, extract scoring logic into a helper module `scoring.py` in the same folder.

## Done definition

This task is done when all of the following are true:

1. `pytest backend/tests/agent_evals/` runs to completion and prints a per-fixture pass/fail summary.
2. The 10 fixtures listed above are present in `fixtures.py` with the exact `name` strings.
3. `python -m backend.tests.agent_evals.runner` produces the same summary as a CLI command.
4. No external HTTP calls happen during a run (verified by a `responses` or `httpx_mock` block, or by stubbed tool functions).
5. The current regex router's score is captured and pasted into the final reply as the baseline (e.g. `baseline: 6/10 passed`). Do not try to improve the score; we want the unvarnished number.
6. `runner.py` ≤ 250 lines, `fixtures.py` is data only (no logic beyond the dataclass/TypedDict definitions).
7. No CLAUDE.md edits, no `graph.py` logic changes, no `main.py` edits.

When done, reply with: the baseline score, the per-fixture failure list, and a one-line summary of which fixtures the regex router struggles with most. That output becomes the input for the next session, where we'll decide whether to swap the router or collapse the agents.

---

## What this is *not*

This is not the routing fix. It is the instrument that lets us *measure* routing fixes. If at any point you find yourself wanting to change the router to make a fixture pass, stop — the fixture failing is the point. Capture the failure honestly and move on.
