import re
import json
import time
import logging
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from config import settings
from agent.skills import inject_skill

logger = logging.getLogger(__name__)

ITINERARY_SYSTEM = """You are a travel itinerary planner. Output ONLY a raw JSON object — no prose, no markdown, no code fences.

Rules:
- First day: flight arrival + hotel check-in
- Last day: hotel check-out + departure flight
- Spread places across days evenly (3–5 events per day)
- Schedule indoor venues on rainy days (high precipitation_probability)
- Include coordinates for every event where known

Output schema (return this exact structure, nothing else):
{"trip_id":"auto","destination":"string","days":[{"day_number":1,"date":"YYYY-MM-DD","city":"string","label":"string","weather_icon":"emoji","weather_high":22,"weather_low":15,"events":[{"time":"HH:MM","title":"string","subtitle":"string","type":"flight|hotel|activity|poi|food|transport","price_local":"optional","duration_minutes":90,"coordinates":{"lat":0.0,"lng":0.0}}]}]}"""


@tool
def generate_itinerary(
    destination: str,
    start_date: str,
    end_date: str,
    hotel: dict | None = None,
    flights: dict | None = None,
    places: list[dict] | None = None,
    weather: list[dict] | None = None,
) -> dict:
    """Generate a structured day-by-day itinerary as JSON, stitching together flights,
    hotel check-in/out, recommended places, meals, and weather-aware activity scheduling.
    Call this last, after search_flights, search_hotels, search_places, get_weather_forecast,
    and calculate_budget have all returned results. Pass the full results from those tools
    as the hotel/flights/places/weather arguments.
    Returns a schema the frontend renders as a timeline."""
    raw: str = ""
    try:
        logger.info(f"generate_itinerary invoked: destination={destination} dates={start_date}..{end_date} places_count={len(places or [])} weather_count={len(weather or [])}")

        # Separate LLM call just for itinerary generation — lower temperature for consistent JSON
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.2,
            openai_api_key=settings.openai_api_key,
            request_timeout=30,  # type: ignore[call-arg]
            max_retries=0,
        )

        # Slim down inputs to avoid token overload. All inputs optional — degrade gracefully.
        hotel = hotel or {}
        flights = flights or {}
        slim_hotel = {k: hotel.get(k) for k in ("name", "stars", "price_per_night_gbp", "city")}
        slim_flights = {k: flights.get(k) for k in ("airline", "flight_number", "origin", "destination", "departure_date", "return_date", "departure_time")} if isinstance(flights, dict) else flights
        slim_places = [
            {k: p.get(k) for k in ("name", "category", "rating", "lat", "lng", "open_now")}
            for p in (places or [])
        ]
        slim_weather = [
            {k: w.get(k) for k in ("date", "condition", "weather_icon", "temp_high_c", "temp_low_c", "precipitation_probability")}
            for w in (weather or [])
        ]

        prompt = (
            f"Destination: {destination}\n"
            f"Dates: {start_date} to {end_date}\n"
            f"Hotel: {json.dumps(slim_hotel)}\n"
            f"Flights: {json.dumps(slim_flights)}\n"
            f"Places: {json.dumps(slim_places)}\n"
            f"Weather: {json.dumps(slim_weather)}\n\n"
            "Return the JSON object only."
        )
        prompt = inject_skill("itinerary_builder", prompt)

        messages = [SystemMessage(content=ITINERARY_SYSTEM), HumanMessage(content=prompt)]

        # Single attempt with short retry on rate-limit only
        for attempt in range(2):
            try:
                response = llm.invoke(messages)
                break
            except Exception as e:
                if "rate_limit" in str(e).lower() and attempt < 1:
                    logger.warning(f"Itinerary rate-limited, retrying in 5s (attempt {attempt + 1})")
                    time.sleep(5)
                else:
                    raise

        raw = response.content.strip()  # type: ignore[union-attr]

        # Strip any markdown code fences the model adds despite instructions
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"```\s*$", "", raw, flags=re.MULTILINE)
        raw = raw.strip()

        # Pull out the outermost JSON object in case of surrounding prose
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        itinerary = json.loads(raw)
        days_count = len(itinerary.get("days", [])) if isinstance(itinerary, dict) else 0
        logger.info(f"Itinerary built for {destination}: {days_count} days")
        if days_count == 0:
            logger.warning(f"Itinerary has 0 days — raw output was: {raw[:400]}")
        # Signal to the ReAct loop: itinerary is complete, no more tools needed
        itinerary["__done"] = True
        return itinerary

    except json.JSONDecodeError as e:
        logger.error(f"Itinerary JSON parse failed: {e}; raw: {raw[:400]}")
        return {"error": f"Itinerary JSON was malformed: {str(e)[:120]}"}
    except Exception as e:
        logger.error(f"Itinerary generation failed: {e}", exc_info=True)
        return {"error": f"Itinerary generation failed: {str(e)[:120]}"}
