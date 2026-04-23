from langchain_core.tools import tool


@tool
def calculate_budget(
    flight_price_per_person: float,
    hotel_price_per_night: float,
    num_nights: int,
    num_people: int,
    activities_estimate: float = 0,
    food_per_day_estimate: float = 0,
    total_budget: float = 0,
) -> dict:
    """Calculate total trip cost breakdown and compare against the user's budget.
    All prices should be in GBP. Returns itemised costs and whether the trip is within budget.
    Call this before generate_itinerary so the agent knows if alternatives are needed."""
    flights_total = flight_price_per_person * num_people
    hotel_total = hotel_price_per_night * num_nights
    activities_total = activities_estimate
    food_total = food_per_day_estimate * num_nights

    grand_total = flights_total + hotel_total + activities_total + food_total
    within_budget = (grand_total <= total_budget) if total_budget > 0 else None
    over_by = round(grand_total - total_budget, 2) if total_budget > 0 and not within_budget else 0

    return {
        "breakdown": {
            "flights_gbp": round(flights_total, 2),
            "hotel_gbp": round(hotel_total, 2),
            "activities_gbp": round(activities_total, 2),
            "food_gbp": round(food_total, 2),
        },
        "total_gbp": round(grand_total, 2),
        "budget_gbp": total_budget if total_budget > 0 else None,
        "within_budget": within_budget,
        "over_by_gbp": over_by,
        "per_person_gbp": round(grand_total / num_people, 2) if num_people else grand_total,
    }
