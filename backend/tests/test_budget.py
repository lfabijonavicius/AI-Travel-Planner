from agent.tools.budget import calculate_budget


def test_within_budget():
    result = calculate_budget.invoke({
        "flight_price_per_person": 300.0,
        "hotel_price_per_night": 100.0,
        "num_nights": 7,
        "num_people": 2,
        "activities_estimate": 200.0,
        "food_per_day_estimate": 50.0,
        "total_budget": 2000.0,
    })
    # flights=600, hotel=700, activities=200, food=350 → 1850
    assert result["total_gbp"] == 1850.0
    assert result["within_budget"] is True
    assert result["over_by_gbp"] == 0


def test_over_budget():
    result = calculate_budget.invoke({
        "flight_price_per_person": 500.0,
        "hotel_price_per_night": 200.0,
        "num_nights": 7,
        "num_people": 2,
        "total_budget": 1500.0,
    })
    # flights=1000, hotel=1400 → 2400, over by 900
    assert result["within_budget"] is False
    assert result["over_by_gbp"] == 900.0


def test_no_budget_provided():
    result = calculate_budget.invoke({
        "flight_price_per_person": 200.0,
        "hotel_price_per_night": 80.0,
        "num_nights": 5,
        "num_people": 1,
    })
    assert result["within_budget"] is None
    assert result["budget_gbp"] is None


def test_per_person_calculation():
    result = calculate_budget.invoke({
        "flight_price_per_person": 300.0,
        "hotel_price_per_night": 0.0,
        "num_nights": 3,
        "num_people": 3,
    })
    assert result["breakdown"]["flights_gbp"] == 900.0
    assert result["per_person_gbp"] == 300.0
