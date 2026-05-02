"""Eval fixtures — data only, no logic."""
from typing import Any
from typing_extensions import TypedDict


class Fixture(TypedDict):
    name: str
    messages: list[dict]
    expected_mode: str
    expected_tools_any_of: list[list[str]]
    must_extract: dict[str, Any]


FIXTURES: list[Fixture] = [
    {
        "name": "fully_specified_plan",
        "messages": [
            {
                "role": "user",
                "content": "plan a 5-day trip to lisbon for 2 adults from london, may 12-17, budget £2000",
            }
        ],
        "expected_mode": "planner",
        "expected_tools_any_of": [
            ["search_flights", "search_hotels"],
            ["search_flights", "search_hotels", "get_weather_forecast"],
            [
                "search_flights",
                "search_hotels",
                "get_weather_forecast",
                "get_currency_exchange",
                "get_country_info",
                "search_places",
                "calculate_budget",
                "generate_itinerary",
            ],
        ],
        "must_extract": {
            "party_size": 2,
            "origin": "London",
            "destination": "Lisbon",
            "start_date": "2026-05-12",
            "end_date": "2026-05-17",
            "budget_gbp": 2000,
        },
    },
    {
        "name": "vague_discovery_partner",
        "messages": [
            {
                "role": "user",
                "content": "my partner and i want to go somewhere romantic in late spring",
            }
        ],
        "expected_mode": "discovery",
        "expected_tools_any_of": [[], ["suggest_destinations"]],
        "must_extract": {"party_size": 2, "date_hint": "late spring"},
    },
    {
        "name": "partial_intake_no_dates",
        "messages": [
            {
                "role": "user",
                "content": "i want to go to tokyo from london, two of us",
            }
        ],
        "expected_mode": "planner_intake",
        "expected_tools_any_of": [[]],
        "must_extract": {
            "party_size": 2,
            "origin": "London",
            "destination": "Tokyo",
        },
    },
    {
        "name": "flight_only_lookup",
        "messages": [
            {
                "role": "user",
                "content": "what flights are there from london to barcelona on june 3?",
            }
        ],
        "expected_mode": "flight_lookup",
        "expected_tools_any_of": [["search_flights"]],
        "must_extract": {
            "origin": "London",
            "destination": "Barcelona",
            "start_date": "2026-06-03",
        },
    },
    {
        "name": "place_only_lookup",
        "messages": [
            {
                "role": "user",
                "content": "any good ramen near shibuya station?",
            }
        ],
        "expected_mode": "place_lookup",
        "expected_tools_any_of": [["search_places"]],
        "must_extract": {"destination": "Shibuya"},
    },
    {
        "name": "country_info_lookup",
        "messages": [
            {
                "role": "user",
                "content": "do i need a visa for vietnam as a british citizen?",
            }
        ],
        "expected_mode": "info",
        "expected_tools_any_of": [["get_country_info"]],
        "must_extract": {"destination": "Vietnam"},
    },
    {
        "name": "weather_lookup",
        "messages": [
            {
                "role": "user",
                "content": "what's the weather like in rome next week?",
            }
        ],
        "expected_mode": "info",
        "expected_tools_any_of": [
            ["get_weather_forecast"],
            ["get_weather_forecast", "get_city_pin"],
            ["get_city_pin", "get_weather_forecast"],
        ],
        "must_extract": {"destination": "Rome"},
    },
    {
        "name": "mid_conversation_pivot",
        "messages": [
            {"role": "user", "content": "thinking about iceland in december"},
            {
                "role": "assistant",
                "content": "How many people travelling and where from?",
            },
            {
                "role": "user",
                "content": "two of us from manchester, budget around £1500",
            },
        ],
        "expected_mode": "planner",
        "expected_tools_any_of": [
            ["search_flights", "search_hotels"],
            [
                "search_flights",
                "search_hotels",
                "get_weather_forecast",
                "get_currency_exchange",
                "get_country_info",
                "search_places",
                "calculate_budget",
                "generate_itinerary",
            ],
        ],
        "must_extract": {
            "destination": "Iceland",
            "party_size": 2,
            "origin": "Manchester",
            "budget_gbp": 1500,
            "date_hint": "December",
        },
    },
    {
        "name": "ambiguous_followup",
        "messages": [
            {
                "role": "user",
                "content": "can you suggest somewhere warm in february?",
            },
            {
                "role": "assistant",
                "content": "What's your budget and where are you flying from?",
            },
            {"role": "user", "content": "london, around £1000pp"},
        ],
        "expected_mode": "discovery",
        "expected_tools_any_of": [[], ["suggest_destinations"]],
        "must_extract": {
            "origin": "London",
            "budget_gbp": 1000,
            "party_size": None,
            "date_hint": "February",
        },
    },
    {
        "name": "out_of_scope_question",
        "messages": [
            {"role": "user", "content": "what's the capital of france?"}
        ],
        "expected_mode": "info",
        "expected_tools_any_of": [["get_country_info"], []],
        "must_extract": {"destination": "France"},
    },
]
