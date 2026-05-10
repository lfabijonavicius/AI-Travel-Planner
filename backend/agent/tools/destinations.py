import json
import logging
import requests
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from config import settings

logger = logging.getLogger(__name__)

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PHOTO_BASE = "https://places.googleapis.com/v1"

DESTINATION_SYSTEM = """You are a travel destination curator. Given a user's criteria (theme, season, mood, budget), suggest a diverse and interesting list of cities or regions they could visit.

Output ONLY a raw JSON array — no prose, no markdown, no code fences.

Each destination must have:
- name: the city or region name
- headline: a short trip-concept label, like "Quick warm Europe" or "Beach + food"
- country: the country it's in
- region: broader area (e.g. "Andalusia, Spain" or "Greek Islands")
- description: 2-3 sentences capturing why it's great for the user's criteria. Specific, evocative, not generic.
- why_now: one short sentence explaining why this destination fits the requested timing or season
- best_for: one short sentence naming the kind of traveller or vibe this suits best
- tradeoff: one honest sentence about a downside or tradeoff
- plan_title: a 3-6 word planning label for the trip card
- tags: 2-4 short descriptor tags (e.g. ["Beach", "Culture", "Nightlife"])

Output schema: [{"name":"...","headline":"...","country":"...","region":"...","description":"...","why_now":"...","best_for":"...","tradeoff":"...","plan_title":"...","tags":["..."]}]

Aim for variety: different geographies, trip speeds, and vibes.
For "surprise me" style requests, make the options feel meaningfully different from one another rather than just naming four warm places."""


def _fetch_place_details(query: str) -> dict:
    """Fetch a single place's photo and coordinates via Google Places."""
    try:
        response = requests.post(
            PLACES_SEARCH_URL,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": settings.google_places_api_key,
                "X-Goog-FieldMask": "places.location,places.photos,places.rating,places.userRatingCount",
            },
            json={"textQuery": query, "pageSize": 1},
            timeout=8,
        )
        response.raise_for_status()
        places = response.json().get("places", [])
        if not places:
            return {}
        p = places[0]
        loc = p.get("location", {})
        photos = p.get("photos", []) or []
        photo_url = None
        if photos:
            photo_name = photos[0].get("name")
            if photo_name:
                r = requests.get(
                    f"{PHOTO_BASE}/{photo_name}/media",
                    params={
                        "maxWidthPx": 1600,
                        "key": settings.google_places_api_key,
                        "skipHttpRedirect": "false",
                    },
                    allow_redirects=True,
                    timeout=5,
                )
                photo_url = r.url
        return {
            "lat": loc.get("latitude"),
            "lng": loc.get("longitude"),
            "photo_url": photo_url,
            "rating": p.get("rating"),
            "rating_count": p.get("userRatingCount"),
        }
    except Exception as e:
        logger.warning(f"Place details lookup failed for '{query}': {e}")
        return {}


@tool
def suggest_destinations(
    criteria: str,
    month: str = "",
    origin: str = "",
    max_results: int = 5,
) -> list[dict]:
    """Suggest travel destinations matching a user's open-ended criteria.
    Use when the user asks for ideas, inspiration, or says things like 'surprise me',
    'somewhere warm', 'where should I go?', or 'suggest destinations'.
    criteria: free-text criteria (e.g. 'warm in May', 'beach + nightlife', 'cultural city break').
    origin: IATA city/airport code or city name where the user is flying from. Pass when known.
    month: optional month name or YYYY-MM if relevant.
    Returns a list of destinations with name, country, description, photo, coordinates, and rating.
    Do NOT call the full trip-planning tools after this — the user must pick a destination first."""
    try:
        logger.info(f"suggest_destinations invoked: criteria={criteria!r} month={month!r} origin={origin!r}")

        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            openai_api_key=settings.openai_api_key,
            request_timeout=25,  # type: ignore[call-arg]
            max_retries=0,
        )

        prompt = (
            f"User criteria: {criteria}\n"
            f"Origin: {origin or 'unspecified'}\n"
            f"Month: {month or 'flexible'}\n"
            f"Return {max_results} destinations as a JSON array."
        )
        messages = [SystemMessage(content=DESTINATION_SYSTEM), HumanMessage(content=prompt)]

        response = llm.invoke(messages)
        raw = response.content.strip()  # type: ignore[union-attr]

        # Strip code fences if present
        if raw.startswith("```"):
            raw = raw.split("```", 2)[-1].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()
        # Pull out array in case of surrounding prose
        if "[" in raw and "]" in raw:
            raw = raw[raw.index("[") : raw.rindex("]") + 1]

        suggestions = json.loads(raw)
        if not isinstance(suggestions, list):
            return [{"error": "Destination output was not a list"}]

        enriched: list[dict] = []
        for dest in suggestions[:max_results]:
            if not isinstance(dest, dict) or not dest.get("name"):
                continue
            query = f"{dest['name']}, {dest.get('country', '')}".strip(", ")
            details = _fetch_place_details(query)
            enriched.append({
                "name": dest.get("name"),
                "headline": dest.get("headline", ""),
                "country": dest.get("country", ""),
                "region": dest.get("region", ""),
                "description": dest.get("description", ""),
                "why_now": dest.get("why_now", ""),
                "best_for": dest.get("best_for", ""),
                "tradeoff": dest.get("tradeoff", ""),
                "plan_title": dest.get("plan_title", ""),
                "tags": dest.get("tags", [])[:4],
                "lat": details.get("lat"),
                "lng": details.get("lng"),
                "photo_url": details.get("photo_url"),
                "rating": details.get("rating"),
                "rating_count": details.get("rating_count"),
            })

        logger.info(f"suggest_destinations returned {len(enriched)} destinations")
        return enriched

    except json.JSONDecodeError as e:
        logger.error(f"Destination JSON parse failed: {e}")
        return [{"error": f"Destination output was malformed: {str(e)[:120]}"}]
    except Exception as e:
        logger.error(f"Destination suggestion failed: {e}", exc_info=True)
        return [{"error": f"Destination suggestion failed: {str(e)[:120]}"}]
