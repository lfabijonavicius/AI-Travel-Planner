from langchain_core.tools import tool
from agent.tools.places import _google_text_search


@tool
def get_city_pin(city: str) -> dict:
    """Get a city-level map pin with coordinates, photo gallery, and editorial summary.

    Call this whenever a city is the main focus of the conversation — for weather questions,
    "things to do in X", "best time to visit X", general destination info, or any query where
    the map should anchor to a city. Returns a single PlaceResult-compatible dict with name,
    lat, lng, photo_url, photo_urls, and summary. Never use search_places for a city overview."""
    results = _google_text_search(city, "city", max_results=1, photos_per_place=6)
    if not results or "error" in results[0]:
        return {"error": f"Could not find city: {city}"}
    result = dict(results[0])
    result["category"] = "city"
    return result
