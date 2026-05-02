from typing import Any

from langchain_openai import ChatOpenAI

from agent.tools import (
    calculate_budget,
    generate_itinerary,
    get_city_pin,
    get_country_info,
    get_currency_exchange,
    get_current_weather,
    get_weather_forecast,
    search_flights,
    search_hotels,
    search_places,
    suggest_destinations,
)
from agent.single_agent import build_single_agent
from config import settings


def _build_llm(*, enable_tool_calls: bool) -> Any:
    llm = ChatOpenAI(
        model="gpt-4.1-mini",
        temperature=0.5,
        streaming=True,
        openai_api_key=settings.openai_api_key,
    )
    if enable_tool_calls:
        return llm.bind(parallel_tool_calls=False)
    return llm


graph = build_single_agent()
