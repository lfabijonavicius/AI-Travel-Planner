# Instructions: Post-deletion polish PR — prompt firmness, itinerary gating, and multi-turn rules

> Paste this into a fresh Claude Code session in the Voyager repo. Do not modify it before sending.

---

## Problem

The single-agent architecture is shipped and the harness scores 8/10. Manual smoke testing surfaced ~10 distinct UX bugs that the eval doesn't catch (because eval scores tools + extraction, not behaviour quality). They sort into three buckets:

**Bucket 1 — prompt firmness.** The unified prompt is too polite. The agent: asks 3 clarifying questions in a list when the rule says one; returns 5 destination cards when the rule says 3; auto-extends a flight-only lookup into a full itinerary; ends most responses with chatty *"Would you like help with..."* upsells.

**Bucket 2 — itinerary auto-firing.** `generate_itinerary` is called even when prerequisites haven't been met properly: when flight dates don't match the user's request (`matches_requested_dates=false`), when flight search returned zero results, and when the user only asked for flights (no hotels searched). Wastes tokens and surfaces wrong outputs.

**Bucket 3 — multi-turn handling.** Mostly working but two specific gaps: when asking a clarifying question, agent doesn't restate the context it heard; when given an ambiguous follow-up, agent occasionally anchors on the most recent plan instead of the most recent question.

This PR fixes buckets 1 and 2 in the prompt and one tool-arg change. Bucket 3's restate-context fix is also in this PR. Bucket 3's anchoring problem and the frontend-side issues (hotel currency conversion, country-info card layout, date-adjustment label copy) are out of scope — separate tickets.

## Solution

Tighten `unified.md` with assertive, imperative language for the rules the model is currently ignoring. Pass `n=3` to `suggest_destinations` (or whatever the destination tool's count parameter is — verify in the tool definition). Re-run the harness and the manual smoke. Expected outcome: harness stays at ≥8/10, smoke tests show the buckets-1-and-2 issues resolved.

## Out of scope

- Do not edit any agent code beyond the prompt and one tool argument.
- Do not edit any tool implementations.
- Do not touch the eval harness or fixtures.
- Do not attempt to fix the multi-turn anchoring issue (where "september, london, 2 travelers" resolved to Lisbon instead of Tokyo). That requires deeper conversation-state work — separate ticket.
- Do not touch frontend rendering: hotel currency display in JPY, country-info card layout, date-adjustment label copy. Frontend issues, separate tickets.
- Do not add new fixtures.
- Do not optimise prompt phrasing past one revision per rule. We want assertive enforcement, not a literary masterpiece.

---

## Exact changes to `backend/agent/prompts/unified.md`

The prompt currently has a decision rule and output rules. Add the lines below, **assertively phrased**. The model treats polite advice as suggestion; treat these as commands.

### 1. One-question rule — replace existing intake guidance

Find the rule that says something like *"if information is missing, ask a clarifying question"* and replace with:

```
When information is missing, ask EXACTLY ONE clarifying question.
Never list multiple missing fields. Never use numbered lists of
questions. Pick the single most important missing field — usually
travel dates — and ask only about that one. Wait for the user's
answer before asking the next thing.
```

If the existing rule is on multiple lines, replace all of them. Goal: a single, unambiguous, imperative paragraph. No examples.

### 2. Restate-context rule — add before the one-question rule

```
When asking a clarifying question, briefly restate what you've
already understood so the user knows you heard them. Format:
"Got it — [destination, party, budget, etc.]. [One question]?"
```

### 3. Match-scope rule — add to the decision-rule section

```
Match the response to the question. If the user asked only about
flights, return flights and stop — do not search hotels, do not
build an itinerary, do not offer a full plan. If they asked about
weather, return weather and stop. If they asked a one-shot factual
question, answer it and stop. Only build a full itinerary when the
user has explicitly asked to plan a trip with all required
information present.
```

### 4. No-upsell rule — add to the output rules

```
Never end a response with offers like "Would you like me to...?"
or "Shall I proceed with...?" or "Want me to look at...?". The user
will tell you what they want next. End the response when the answer
is complete.
```

### 5. Itinerary-gating rule — add to the tool-calling rules

```
Call generate_itinerary ONLY when ALL of these are true:
  - User has explicitly asked to plan a trip (not asked for a single
    lookup like flights or weather).
  - search_flights has returned at least one result with
    matches_requested_dates=true.
  - search_hotels has returned at least one result.
  - The user has not since changed any planning constraint
    (destination, dates, party, budget).
If matches_requested_dates is false on flights, ASK the user
whether the substitute dates are acceptable before calling
generate_itinerary. Never assume.
```

### 6. Discovery-count rule — sharpen the existing rule

Find the existing line about presenting destinations and replace with:

```
When suggesting destinations, present EXACTLY 3 options. Pass n=3
to the destination tool. Never present more — fewer choices help
the user decide.
```

If `suggest_destinations` (or whatever it's named) doesn't accept an `n` parameter, just do the prompt-level limit and document the missing param as a follow-up ticket. Verify the tool's signature before deciding.

---

## Other change

In `single_agent.py` (or wherever the agent's tools are wired), if the destination-suggestion tool accepts a count parameter, pre-bind it to 3 at agent build time so the model can't accidentally pass a different value. If the tool has a default of 5 hardcoded, capture that as a follow-up ticket but don't fix it here.

---

## Implementation rules

- **Total prompt lines added/changed: target ≤25.** If the prompt grows past 90 lines (current ceiling is 80), trim something redundant first. The prompt is the agent — keep it tight.
- **Use assertive imperative voice.** "MUST", "NEVER", "EXACTLY ONE" — uppercase the keywords if it helps. The model will not enforce polite suggestions.
- **No examples in the prompt.** Examples bloat context and bias toward exact phrasing.
- **No new files.**
- **Test-first.** Before editing the prompt, run the harness once and capture the score. After edits, run again. Score must stay ≥8/10. If it drops, the prompt change introduced a regression — back out and ask the user.
- **Manual smoke needed after.** The harness can't detect bucket-1 and bucket-2 issues; only manual testing can. Don't claim success until the user has manually verified the bucket-1 and bucket-2 fixes in the UI.

## Done definition

This task is done when all of the following are true:

1. `unified.md` contains all six rule changes above, in assertive imperative voice.
2. `unified.md` is ≤90 lines.
3. The destination tool count is bound to 3 at the prompt level (and the tool-arg level if the tool accepts it).
4. `pytest backend/tests/agent_evals/` passes with the single-agent variant scoring ≥8/10.
5. `single_agent.py` is unchanged except possibly for the destination-tool count binding.
6. `unified.md` is the only prompt file edited.
7. No edits to graph.py, main.py, streaming.py, runner.py, scoring.py, fixtures.py, or any tool implementation.

When done, reply with:

- The new harness score (must be ≥8/10).
- A diff summary: which rules were added/changed and the line count delta in unified.md.
- A short list of the 5 manual smoke tests the user should rerun in the UI to verify each bucket-1 and bucket-2 fix:
    1. Intake test (expect: one question, with restated context)
    2. Flight-only lookup (expect: flights only, no hotels, no itinerary, no upsell)
    3. Currency-only test (expect: widget updates, no upsell)
    4. Discovery test (expect: exactly 3 cards)
    5. Itinerary gating: full plan with mismatched dates (expect: agent asks if substitute dates acceptable, does not auto-build)

---

## What this is *not*

This is not a multi-turn anchoring fix. It is not a frontend fix. It is not a tool-implementation change. The polish PR is intentionally narrow — six prompt rules and one tool argument. Anything beyond that is a separate ticket. If you find yourself wanting to fix the JPY hotel display or the country-info card while you're here, capture it as a follow-up and move on. Mixing concerns is how regressions hide.
