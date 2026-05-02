# Agent Router Eval Harness

Measures routing correctness of the regex-based `detect_mode()` router across 10
representative conversations. Scores three axes per fixture: routed mode, tools
called, and key entities extracted.

## Running

```bash
# CLI — coloured pass/fail summary (router variant, default)
python -m backend.tests.agent_evals.runner

# Single-agent experiment — runs both variants and prints Δ behavioral
python -m backend.tests.agent_evals.runner --variant single

# pytest — same run, assertion-based exit code
pytest backend/tests/agent_evals/ -m slow
```

Both produce identical output. Traces for failed fixtures are written to
`backend/tests/agent_evals/.last_run/router/<fixture_name>.json` (router) or
`.last_run/single/<fixture_name>.json` (single-agent variant).

`--variant single` runs the router first (for a comparable behavioral baseline),
then the single-agent variant, and prints a signed `Δ behavioral` at the end.

## Adding a fixture

1. Open `fixtures.py` and add a `Fixture` TypedDict to `FIXTURES`.
2. Set `name` (snake_case, unique), `messages` (full conversation history),
   `expected_mode` (one of the six modes in `router.py`), `expected_tools_any_of`
   (list of acceptable tool-call sets — each inner list is one valid outcome),
   and `must_extract` (entities the agent or its tool calls must surface).
3. Keep fixtures deterministic — no live API calls, no dates that drift with time.
   Use absolute ISO dates (e.g. `"2026-06-03"`) not relative ones (`"next Tuesday"`).
