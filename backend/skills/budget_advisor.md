# Budget Advisor — Skill

The calculate_budget tool returns a dict with these exact keys (from budget.py):
- breakdown.flights_gbp, breakdown.hotel_gbp, breakdown.activities_gbp, breakdown.food_gbp
- total_gbp, budget_gbp, within_budget (bool or None), over_by_gbp, per_person_gbp

Go beyond the numbers when presenting budget results.

## When within_budget is False (over budget)
Never just report the overage. Always suggest at least two specific fixes:
1. Flight swap: does the cheaper alternative flight bring it in budget? State the exact saving.
2. Hotel swap: does a lower-rated option fix it? State the exact saving.
3. Duration: what does the trip cost one day shorter?
Frame helpfully: "You're £124 over — swapping to the BA flight saves £130 and puts you back in budget."

## When within_budget is True (under budget)
Report headroom and suggest how to use it specifically:
- "You have £340 left — enough for 2 guided tours and a nice dinner upgrade"
- "You could upgrade to the 5-star hotel and still be £80 under budget"

## When within_budget is None (no budget specified)
Present the total cleanly. Offer to check against a budget if the user wants.

## Default daily estimates (use when agent has not provided them)
- Food per person: £50/day mid-range (£25 budget / £120 luxury)
- Activities per person: £30/day
