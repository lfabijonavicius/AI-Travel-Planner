# Instructions: Build the single-agent variant and score it against the eval harness

> Paste this into a fresh Claude Code session in the Voyager repo. Do not modify it before sending.

---

## Problem

The eval harness baseline came in at 1/10. Failure analysis showed three root patterns: term lists too narrow, multi-turn context ignored, and `info` mode acting as a catch-all that masks failures. Two of the nine failures (`country_info_lookup`, `weather_lookup`) were mode-correct-tools-wrong, which means routing alone can't fix them — they're caused by per-agent prompt scoping. That's an architectural problem, not a router problem.

Before we add complexity (LLM classifier, semantic intent, etc.), we need to test the simpler hypothesis: that **collapsing to one agent with all tools beats the multi-agent split**, on the same harness, scored honestly.

## Solution

Build a single-agent variant of the graph behind an environment-variable feature flag. The variant has:

- One ReAct agent.
- All 11 tools available.
- One unified system prompt covering all 6 modes' behaviour.
- No `_detect_mode`, no router, no per-mode prompts.

Run the existing eval harness against the variant. Report the new score side-by-side with the regex baseline. End state: a `python -m backend.tests.agent_evals.runner --variant single` command that prints a score, plus a 1-paragraph recommendation at the end of the reply.

This is a vertical experiment — it touches the graph, the agent module, the harness, and a new prompt file. End-to-end runnable. Feature-flagged so production behaviour is unchanged.

## Out of scope

- Do not delete the regex router. Do not delete `_detect_mode`. Do not delete any of the 6 existing agents or their prompts. We are running an A/B, not a refactor.
- Do not change the eval fixtures. Do not change the scoring rules beyond what this PRD specifies.
- Do not change any tool implementation.
- Do not optimise the unified prompt past one revision. We want the first honest score, not a tuned one.
- Do not add new tools. Do not add an LLM classifier. Do not add semantic intent detection.
- Do not change `main.py` routes or the SSE pipeline.
- Do not commit to keeping the variant. The experiment ends with a number, not a deployment.

---

## File plan

Create or modify exactly these files. Nothing else.

```
backend/agent/single_agent.py                        # NEW — the collapsed ReAct agent
backend/agent/prompts/__init__.py                    # NEW (if folder doesn't exist) — empty
backend/agent/prompts/unified.md                     # NEW — single system prompt, ≤80 lines
backend/agent/graph.py                               # MODIFY — add feature-flag branch only
backend/tests/agent_evals/runner.py                  # MODIFY — add --variant flag
backend/tests/agent_evals/scoring.py                 # MODIFY — add variant-aware pass rule
backend/tests/agent_evals/README.md                  # MODIFY — document --variant usage
```

If any NEW path already exists, stop and ask the user before overwriting.

---

## `single_agent.py` — exact shape

A single public function:

```python
def build_single_agent(model: str | None = None) -> CompiledGraph:
    """
    Build a one-agent ReAct graph with all 11 tools and the unified prompt.
    No router, no mode detection. Returns a compiled LangGraph identical in
    interface to RoutedGraph (same .ainvoke signature) so the harness and
    main.py can swap them transparently.
    """
```

Internals:
- Load the prompt from `backend/agent/prompts/unified.md` at build time. Read the file once; do not embed the prompt as a Python string literal.
- Wire all 11 tools that the existing per-mode agents use, deduplicated. Confirm the count — if it's not 11, use whatever the actual deduplicated count is and report it in the final reply.
- Use `create_react_agent` (the same primitive the existing per-mode agents use) so behaviour at the LangGraph level is unchanged — only the prompt and tool set differ.
- The compiled graph must accept and return the same state shape `RoutedGraph` uses (`messages`, plus whatever trip-context fields are passed through). The harness must not need a special code path for the variant.

Keep this file ≤120 lines. If it grows beyond that, the unified prompt is doing the wrong work — push back and discuss before continuing.

---

## `unified.md` — exact shape

A single Markdown system prompt, **≤80 lines**, that replaces all six existing per-mode prompts. Structure:

1. **Identity (≤5 lines).** "You are Voyager, a travel planning agent." What you do, what you don't.
2. **Tool inventory (≤15 lines).** One line per tool: name + when to use it. Don't paraphrase the docstrings — point at them.
3. **Decision rule (≤20 lines).** A small flowchart in prose:
   - If the user gave a destination + origin + dates + party size → plan the trip (call `search_flights`, `search_hotels`, then `generate_itinerary` after both resolve).
   - If they gave a destination but key fields are missing → ask one clarifying question. One. Not a list.
   - If they have no destination and want suggestions → call `suggest_destinations` (or whatever your discovery tool is named) and present 3 options.
   - If they asked a single factual question (weather, visa, currency, "any good ramen near X") → call exactly the one tool that answers it.
   - If their message contains no travel intent at all → answer briefly without calling tools.
4. **Tool-calling rules (≤15 lines).** The non-negotiables, lifted from CLAUDE.md:
   - Never call `generate_itinerary` before flights and hotels resolve.
   - Never construct booking URLs — backend tools return them.
   - Never hardcode currency.
   - On tool error, recover gracefully; don't loop.
   - Use the conversation history, not just the latest message, when deciding what to do.
5. **Output rules (≤10 lines).** What the assistant text should look like. Brief, no bullet vomit, no recapping the user back to themselves.

Hard rule: **no examples in the prompt.** Examples grow prompts unboundedly and bias the model toward the example's exact phrasing. The decision rule is the contract.

When you write this file, source the content from the existing six prompts in `graph.py` — don't invent. Combine, deduplicate, and compress. If something in the existing prompts doesn't fit the decision rule, flag it in your reply rather than silently dropping it.

---

## `graph.py` — exact modification

Add one feature-flag branch at the top of the module that builds the graph, e.g.:

```python
import os
from backend.agent.single_agent import build_single_agent

def build_agent_graph():
    if os.getenv("VOYAGER_AGENT_MODE") == "single":
        return build_single_agent()
    return RoutedGraph()  # existing default
```

Wire the harness and main.py to call `build_agent_graph()` instead of constructing `RoutedGraph()` directly. **Do not change any other logic in `graph.py`.** No edits to `_detect_mode`, no edits to per-mode prompts, no edits to the routed agent assembly.

---

## `runner.py` and `scoring.py` — exact modifications

Add a `--variant {router,single}` flag to the runner, defaulting to `router` (the existing behaviour, unchanged). When `--variant single` is set:

- Set `VOYAGER_AGENT_MODE=single` in the process environment **before** building the graph.
- Skip the `mode_match` check entirely. The single-agent variant has no internal mode concept, so scoring it on `expected_mode` is a category error.
- Pass criterion becomes `tools_match && extraction_match`. Report this as `behavioral_pass` in the `FixtureResult`.
- Also rerun the existing regex variant under the same `behavioral_pass` rule so the comparison is apples-to-apples. The current strict pass score (1/10) stays as a diagnostic.

Output of a full run should look like:

```
Regex router (baseline)
  Strict pass:     1/10  (mode + tools + extraction)
  Behavioral pass: 2/10  (tools + extraction only)

Single agent (experiment)
  Behavioral pass: X/10
  Failures: [fixture_a, fixture_b, ...]

Δ behavioral: +X
```

Update the README to document `--variant`. Two extra sentences. Do not balloon the README.

---

## Implementation rules

- **Test-first for the new code path.** Before writing `single_agent.py`, write a test in `backend/tests/agent_evals/test_single_agent_smoke.py` that builds the graph, sends one trivial message, and asserts the response is non-empty. Make it fail (because `build_single_agent` doesn't exist), then make it pass. Then proceed.
- **No new dependencies.**
- **Determinism, same as before.** Stubs return canned data, temperature=0, seed pinned where supported, full message traces written to `.last_run/single/<fixture_name>.json` on failure.
- **No edits to fixtures.** If a fixture's `expected_tools_any_of` looks too strict for the single agent (the way `weather_lookup` was for the regex baseline), do **not** loosen it in this PRD — flag it in your final reply as a fixture defect for a separate ticket.
- **Keep `single_agent.py` ≤120 lines and `unified.md` ≤80 lines.** If you can't fit the prompt in 80, stop and ask — that's a signal the decision rule is wrong, not that the budget is wrong.
- **Do not edit CLAUDE.md, CLAUDE.proposed.md, CLAUDE_voyager.md, or any docs outside `docs/specs/` and the agent_evals README.**

## Done definition

This task is done when all of the following are true:

1. `python -m backend.tests.agent_evals.runner --variant router` and `--variant single` both run to completion.
2. `pytest backend/tests/agent_evals/` runs both variants (or a documented subset) and produces a single combined report.
3. The single-agent variant has a `behavioral_pass` score against the same 10 fixtures.
4. The regex baseline's `behavioral_pass` score is also reported (rerun under the new scoring rule).
5. The `Δ behavioral` line shows a signed integer.
6. Production behaviour is unchanged: `VOYAGER_AGENT_MODE` unset → `RoutedGraph` is returned, exactly as today.
7. `.last_run/single/` traces exist for any failures.
8. `single_agent.py` ≤ 120 lines, `unified.md` ≤ 80 lines.

When done, reply with:

- The four numbers: regex strict, regex behavioral, single behavioral, Δ.
- The fixture-by-fixture pass/fail table for the single variant.
- A 1-paragraph honest recommendation: which architecture to keep, based on the score and what failed. If single-agent ≥ regex behavioral, recommend ship single; if ≥ +2 over regex behavioral, recommend deleting the router and the per-mode prompts in a follow-up; if it's worse, recommend keeping the router and trying the LLM classifier next instead.

---

## What this is *not*

This is not the production swap. It is an A/B test scored on the harness. The deliverable is **a number and a recommendation**, not a deployment. If during implementation you find yourself wanting to change the harness, the fixtures, the scoring, or anything beyond the file plan above to make the single-agent variant look better, stop — that's prompt engineering disguised as architecture. The point of the experiment is to find out whether the simpler architecture wins on the test we already trust.
