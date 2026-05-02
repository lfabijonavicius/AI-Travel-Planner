# Instructions: Apply prompt/fixture/stub fixes and re-baseline both variants

> Paste this into a fresh Claude Code session in the Voyager repo. Do not modify it before sending.

---

## Problem

The single-agent experiment landed at 5/10 vs the regex router's 2/10 (Δ +3 behavioral). Failure analysis attributed the five remaining single-agent failures to four distinct, **architecture-orthogonal** root causes:

1. **Year assumption.** The unified prompt doesn't tell the model what today's date is, so it defaults to 2024 and writes `departure_date='2024-06-03'` when the user says "june 3". Affects `fully_specified_plan` and `flight_only_lookup` (+2 expected).
2. **`suggest_destinations` enforcement gap.** The model lists destinations in prose instead of calling the tool when the user has no destination. Affects `vague_discovery_partner` (+1 expected).
3. **Fixture narrowness.** `weather_lookup`'s `expected_tools_any_of` doesn't accept `[get_weather_forecast, get_city_pin]` even though that's the legitimate tool sequence. Both architectures fail this; widening fixes both (+1 expected for each variant).
4. **Stub defect.** `get_country_info` stub returns hardcoded Portugal data regardless of input country argument. Doesn't change the score under current scoring (extraction passes via tool args), but corrupts the agent's downstream reasoning and will matter for any future fixture that scores text content.

There may also be a fifth issue (`mid_conversation_pivot`: agent asked for dates without restating context) which is a UX choice — out of scope for this PR; revisit if needed.

## Solution

Apply targeted, minimal fixes to the prompt, one fixture, and one stub. Re-run the harness against **both** variants. Verify the single-agent variant lands at ≥8/10 behavioral and the gap over the router widens.

This is a small PR — net change should be under 30 lines across the touched files.

## Out of scope

- Do not change the agent architecture. Do not delete the router, the per-mode prompts, the feature flag, or anything in `RoutedGraph`. Deletion is a separate PR after this one verifies.
- Do not add the `mid_conversation_pivot` restate-context fix in this PR. Capture it as a follow-up ticket if you want to.
- Do not add new fixtures. Do not change scoring rules.
- Do not optimise the unified prompt past the two specific lines below.
- Do not edit any other stub. Only the `get_country_info` stub.

---

## Exact changes

### 1. `backend/agent/prompts/unified.md`

Add **two lines** to the prompt — one for the date baseline, one for the discovery enforcement. Place the date line at the very top of the prompt body, after the identity block. Place the enforcement line in the decision-rule section.

Date line (top of body):
```
Today is {{CURRENT_DATE}}. When the user gives relative or partial dates ("next week", "in May", "summer", "june 3"), interpret them relative to this date. Never assume a year other than the current one.
```

Enforcement line (in the decision rule, near the discovery branch):
```
When the user has no destination and is exploring options, ALWAYS call `suggest_destinations`. Never list destination options in prose without calling the tool first.
```

`{{CURRENT_DATE}}` is a template token. In `single_agent.py`, substitute it at agent-build time using `datetime.date.today().isoformat()` before passing the prompt to `create_react_agent`. Do not hardcode a date in the markdown file.

Hard rule: **only those two lines.** No other prompt edits in this PR. The 80-line budget still holds — if adding two lines pushes the prompt over 80, trim something redundant first.

### 2. `backend/tests/agent_evals/fixtures.py`

In the `weather_lookup` fixture, change `expected_tools_any_of` from a single-element list to a two-element list:

```python
"expected_tools_any_of": [
    ["get_weather_forecast"],
    ["get_weather_forecast", "get_city_pin"],
    ["get_city_pin", "get_weather_forecast"],
],
```

Order doesn't matter for tool-call sets, but include both orderings explicitly to make the intent obvious to a future reader. No other fixture changes.

### 3. `backend/tests/agent_evals/runner.py` (or wherever the stubs live)

Change the `get_country_info` stub to echo the `country` argument back in its response, instead of returning hardcoded Portugal data. The minimal change:

```python
def stub_get_country_info(country: str, **kwargs):
    recorder.append(("get_country_info", {"country": country, **kwargs}))
    return {
        "name": country,
        "capital": "Stub Capital",
        "region": "Stub Region",
        "languages": ["English"],
        "currencies": [{"code": "GBP", "name": "Pound", "symbol": "£"}],
        # ... other fields shaped like the real CountryInfo type, with country echoed
    }
```

Look at `frontend/types/index.ts::CountryInfo` for the exact shape if needed. The point is: any field that the real API would derive from the country argument should reflect the input country. Static placeholder fields (capital, languages) can stay generic — those don't affect scoring.

If any other stubs have the same input-ignoring bug, fix them in the same way. Note them in the final reply.

### 4. Re-run both variants

After the changes:

```
python -m backend.tests.agent_evals.runner --variant router
python -m backend.tests.agent_evals.runner --variant single
```

Capture the new four numbers in the same format as last run.

---

## Implementation rules

- **No new files.** Every change is an edit to an existing file.
- **No new dependencies.**
- **No edits to `graph.py`.** The feature flag and `RoutedGraph` stay untouched in this PR.
- **No edits to `main.py`.**
- **Preserve the smoke test.** `test_single_agent_smoke.py` and `test_runner_smoke.py` must still pass.
- The unified prompt template substitution must happen in `single_agent.py`, not in the markdown file. The .md stays static; the date is injected at runtime.

## Done definition

This task is done when all of the following are true:

1. `unified.md` contains the two new lines and is still ≤80 lines.
2. `single_agent.py` substitutes `{{CURRENT_DATE}}` with today's ISO date at build time.
3. `weather_lookup` fixture accepts the city-pin variant.
4. `get_country_info` stub echoes the country argument.
5. Both `--variant router` and `--variant single` run cleanly.
6. The new four numbers are captured: regex strict, regex behavioral, single behavioral, Δ.
7. Single behavioral ≥ 8/10. If it isn't, **stop** and report what failed instead of patching further — the prompt fixes were supposed to be sufficient, and if they're not, we want to know exactly which fixture defied the prediction before we touch anything else.
8. Production behaviour unchanged (`VOYAGER_AGENT_MODE` unset → `RoutedGraph` returned).

When done, reply with:

- The four numbers, side-by-side with the previous run for comparison.
- The per-fixture pass/fail table for the single variant only.
- A one-line confirmation: "ready for deletion PR" if single ≥ 8/10, or "predicted fix did not land — investigate fixture X" otherwise.

---

## What this is *not*

This is not the deletion. This PR keeps the router, the feature flag, and the per-mode prompts intact — those go in the next PR, after these numbers verify the prediction. If you find yourself wanting to "just clean up while we're here," stop. Small PRs that do exactly one thing are how we keep the harness honest about which change moved the score.
