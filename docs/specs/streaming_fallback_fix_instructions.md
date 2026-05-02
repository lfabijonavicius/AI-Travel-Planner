# Instructions: Fix the streaming.py itinerary fallback and tighten R1/R4 under complex flows

> Paste this into a fresh Claude Code session in the Voyager repo. Do not modify it before sending.

---

## Problem

Manual smoke test #5 (itinerary gating with mismatched dates) failed despite the prompt-level R5 rule. The user typed *"plan a 5-day trip to Lisbon for 2 adults from London, September 14-19, budget £2000"*. The agent correctly recognised the date mismatch in prose (*"available options are for dates much earlier than your requested September 14-19 trip"*), but `"Building your itinerary…"` still fired automatically and two upsell questions appeared at the end (*"Would you like me to help find alternative flight dates… Or should I focus on one of the hotels…"*).

Three rules failed at once on this complex-flow turn (R1 one-question, R4 no-upsell, R5 itinerary gating) — but R1 and R4 held cleanly on the four simpler smoke tests. The pattern: rules enforce in clean flows and bend under complexity.

**Root cause hypothesis for R5 specifically:** during the router-deletion PR, `streaming.py` line 334 was changed from `if detected_mode == "planner" and not itinerary_buffered:` to `if not itinerary_buffered and ("search_flights" in latest_tool_outputs or "search_hotels" in latest_tool_outputs):`. That fallback fires `generate_itinerary` from the SSE pipeline whenever a planning tool was called in the same turn — regardless of `matches_requested_dates`. It bypasses the agent's R5 decision entirely. The unified-prompt R5 fix from the polish PR was therefore structurally incomplete.

## Solution

Two changes:

1. **Fix streaming.py** so the itinerary fallback respects `matches_requested_dates`. Either tighten the gate or remove the fallback entirely; pick whichever is simpler and more correct after reading the actual code path.
2. **Reinforce R1 and R4 in `unified.md`** with one small block stating these rules apply universally — including under complex flows like date mismatches, partial results, or failed searches.

Out of scope: anything else. No tool changes, no agent code changes beyond streaming.py, no fixture changes, no other prompt rules touched.

---

## Step 1 — Diagnose the streaming.py fallback

**Before changing any code**, read these files and report what you find in your reply:

- `backend/streaming.py` — full file. Pay specific attention to: where the itinerary fallback fires, what `latest_tool_outputs` contains, whether `matches_requested_dates` is accessible from there, and whether `generate_itinerary` ever gets called from the agent's own tool list.
- `backend/agent/single_agent.py` — confirm `generate_itinerary` is in the agent's tool list (i.e. the agent CAN call it directly without needing the streaming fallback).
- `backend/agent/tools/itinerary.py` — confirm the tool's signature and that it doesn't have side effects that require the fallback.

State in your reply:

- Whether `generate_itinerary` is in the single-agent's tool list (yes/no).
- The exact current condition in `streaming.py` and the line number.
- Why the fallback exists historically (what bug it was protecting against in the routed-graph era).
- Whether removing it entirely is safe, given the agent has the tool itself.

## Step 2 — Pick a fix

Based on your diagnosis, pick one of two approaches:

**Approach A — remove the fallback entirely.**
If `generate_itinerary` is in the agent's tool list and the agent's R5 rule is sufficient to govern when it's called, the fallback is now redundant. Delete the `if not itinerary_buffered and (…):` block that fires `generate_itinerary` from streaming.py. Trust the agent.

**Approach B — tighten the gate.**
If the fallback is still needed for some legitimate reason (e.g. the agent doesn't have direct access, or there's a streaming-buffer concern), add a `matches_requested_dates` check. The condition becomes something like:

```python
if (
    not itinerary_buffered
    and "search_flights" in latest_tool_outputs
    and "search_hotels" in latest_tool_outputs
    and any(
        f.get("matches_requested_dates") is True
        for f in latest_tool_outputs.get("search_flights", [])
    )
):
```

Approach A is preferred unless you find a specific reason it's unsafe. Document your choice in your reply.

## Step 3 — Reinforce R1 and R4

In `unified.md`, find R1 (one-question rule) and R4 (no-upsell rule). After R4, add a single new block:

```
These rules apply UNIVERSALLY and WITHOUT EXCEPTION. They are NOT
relaxed when planning becomes complex — when flight dates don't
match, when no flights are found, when search results are partial,
when the user's request runs into any complication. In ALL cases:
ONE question, NO upsell offers. Complexity is not an excuse to
revert to listing options.
```

That's it. Three lines added. No other prompt changes.

If `unified.md` goes over 90 lines after this addition, trim a single redundant line elsewhere (most likely a duplicated phrase in R3 or R5). Do not let the prompt grow past the 90-line ceiling.

## Step 4 — Verify

Run the harness against the single-agent variant. Score must hold at ≥8/10. If it drops, back out the streaming.py change and ask the user — that means the fallback was protecting against something real.

State the score in your reply.

---

## Implementation rules

- **No new files.**
- **No new dependencies.**
- **streaming.py: minimum viable change.** Either delete the fallback block (Approach A) or add the gate condition (Approach B). Do not refactor surrounding code.
- **unified.md: only the three-line block.** No other prompt edits.
- **Do not edit:** `single_agent.py`, `graph.py`, `main.py`, fixtures.py, runner.py, scoring.py, or any tool implementation. Read them for diagnosis only.
- **Do not change the harness or any fixture.**

## Done definition

This task is done when all of the following are true:

1. Diagnosis reported: whether `generate_itinerary` is in the agent toolset, current streaming.py condition + line number, fallback's historical purpose, safety of removal.
2. Approach (A or B) is chosen, justified in one sentence.
3. streaming.py is changed minimally per the chosen approach.
4. `unified.md` contains the three-line reinforcement block; total ≤90 lines.
5. Harness scores ≥8/10 against the single-agent variant.
6. No other files edited.

When done, reply with:

- The diagnosis from Step 1.
- The chosen approach and justification.
- The exact diff: streaming.py line(s) changed and unified.md line(s) added.
- The new harness score.
- A reminder that the user needs to manually re-run smoke test #5 in the UI: type *"plan a 5-day trip to Lisbon for 2 adults from London, September 14-19, budget £2000"* and verify (a) `"Building your itinerary…"` does NOT fire automatically, (b) the agent asks at most ONE question, (c) no `"Would you like me to..."` upsell.

---

## What this is *not*

This is not a refactor of streaming.py. It is not a rewrite of the prompt. It is the smallest change that fixes test #5 plus a guard against R1/R4 backsliding under complexity. If during diagnosis you discover other issues in streaming.py — they're separate tickets, capture them in your reply but do not fix them here.
