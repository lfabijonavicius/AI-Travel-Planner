# Instructions: Delete the regex router and per-mode prompts

> Paste this into a fresh Claude Code session in the Voyager repo **after** the prompt-fix PR has merged and the single-agent variant has scored ≥8/10 on the harness. Do not modify it before sending.

---

## Problem

The single-agent experiment beat the regex router by Δ+3 behavioral. After the prompt-fix PR, the single agent should be at ≥8/10 vs the router stuck at ~3/10. The architectural decision is made: ship the single agent, delete the router.

This is the deletion PR. It removes the multi-agent infrastructure — `_detect_mode`, `RoutedGraph`, the six per-mode prompts, the helpers that supported them, and the feature flag — and wires production directly to `build_single_agent()`.

This is mechanical work. The experiment did the thinking; this PR is the cleanup.

## Solution

Delete dead code in one PR. The agent eval harness is the safety net — every step is gated on the harness still scoring ≥8/10 with the deletion applied.

End state: `backend/agent/graph.py` no longer contains a router. `RoutedGraph`, `_detect_mode`, the six per-mode prompts, and the feature flag are all gone. `build_single_agent()` is the only graph builder. Production traffic flows through it unconditionally.

## Out of scope

- Do not change `single_agent.py` or `unified.md`. The agent under test is the agent we ship.
- Do not change the harness, the fixtures, or the scoring rules.
- Do not "improve" anything you spot along the way. If a non-router file looks wrong, capture it as a follow-up ticket.
- Do not change `main.py` beyond removing the feature-flag plumbing and pointing graph construction at `build_single_agent()`.
- Do not delete `streaming.py`, the SSE pipeline, or any frontend code.
- Do not delete the existing per-tool unit tests (`test_router.py`, `test_budget.py`, etc.) — those are independent and stay.

---

## Inventory: what gets deleted

Before writing any code, **list** the deletion targets in your reply and wait for the user's go-ahead. The list should include:

- All identifiers in `backend/agent/graph.py` related to routing: `_detect_mode`, `_has_specific_destination_hint`, `_has_date_context`, `_has_party_context`, `_has_budget_scope_context`, `_is_explicit_planning_request`, the `_DISCOVERY_TERMS`, `_PLANNING_TERMS`, `_FLIGHT_SEARCH_PHRASES`, `_PLACE_LOOKUP_TERMS` constants, `RoutedGraph` class, and any helper exclusively used by them.
- The six per-mode prompt strings: `FULL_PLANNER_PROMPT`, `PLANNING_INTAKE_PROMPT`, `DISCOVERY_PROMPT`, `INFO_PROMPT`, `PLACE_LOOKUP_PROMPT`, `FLIGHT_LOOKUP_PROMPT`.
- The feature-flag function `build_agent_graph()` and the `VOYAGER_AGENT_MODE` env var check. (After deletion, `main.py` calls `build_single_agent()` directly.)
- `backend/tests/test_router.py` if it tests the regex router specifically. If it tests something more general, keep it but flag what it tests in your reply.
- The `--variant router` flag in the harness. After deletion, the harness has only one variant — there's no router left to compare against.

State the line count delta in your reply (e.g. "removing ~600 lines"). If you're surprised by the count in either direction, flag it.

## Order of operations

Do these in order. Do not skip ahead.

1. **Run the harness against the current state**, single variant only. Capture the score. This is the pre-deletion baseline.
2. **Delete the router-flag plumbing first.** In `graph.py`, remove `build_agent_graph()`. Replace it with `build_single_agent()` exposed at the same import path. Update `main.py` to import and call `build_single_agent()` directly. Run the harness. Score must equal step 1.
3. **Delete `_detect_mode` and its helper functions.** Run the harness. Score must equal step 1.
4. **Delete `RoutedGraph` and its construction.** Run the harness. Score must equal step 1.
5. **Delete the six per-mode prompt strings.** Run the harness. Score must equal step 1.
6. **Delete `test_router.py`** if it's specific to the regex router. Run the full pytest suite. Everything that was green stays green.
7. **Remove the `--variant` flag from the harness.** The runner now runs single-agent unconditionally. Run the harness one final time. Score must equal step 1.
8. **Delete any imports left dangling** in `graph.py`, `main.py`, the harness, or other touched files. Run `python -c "import backend.main"` and `python -c "import backend.agent.graph"` to catch import errors.

If at any step the harness score drops below the step-1 baseline, **stop** and report which step caused the regression. Do not continue deleting until the regression is understood.

---

## Implementation rules

- **No new files.** This is pure deletion plus minimal rewiring.
- **No new dependencies.**
- **No prompt edits.** `unified.md` stays as-is.
- **No fixture edits.**
- **The `single_agent.py` file is untouched** except possibly to inline what `build_agent_graph()` was doing, if the wrapper is no longer needed.
- **Preserve all `# type: ignore` and similar pragmas** that exist in `graph.py` outside the router code — don't remove them as a side effect.
- After every deletion step, run `python -m backend.tests.agent_evals.runner` and verify the score. Do not batch deletions across steps.

## Done definition

This task is done when all of the following are true:

1. `RoutedGraph`, `_detect_mode`, the six per-mode prompts, and all routing helpers/constants are gone from `graph.py`.
2. `main.py` imports and uses `build_single_agent()` directly. No env-var feature flag remains.
3. `--variant` flag is removed from the harness; runner runs single-agent unconditionally.
4. `pytest backend/tests/` passes. The agent_evals run scores equal to the pre-deletion baseline (or higher if a fixture happened to gain).
5. `python -c "import backend.main"` succeeds.
6. Net line delta is reported: "deleted ~X lines, added ~Y lines, net -Z lines."
7. No dangling imports, dead constants, or unreachable code paths in `graph.py`, `main.py`, or the harness.

When done, reply with:

- The pre-deletion and post-deletion harness scores (must be equal).
- The line-count delta.
- A one-paragraph note on anything that surprised you during deletion (e.g. a helper that was unexpectedly used outside the router, an import that turned out to be load-bearing for an unrelated reason). If nothing surprised you, say so.

---

## What this is *not*

This is not a refactor. It is a delete. If you find yourself wanting to rename, restructure, or "tidy" non-deleted code, stop — that's a separate PR. The harness verifies that *removal* is safe; it does not verify *changes* to the code that remains. Mixing them is how regressions hide.
