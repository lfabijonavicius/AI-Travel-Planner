import requests
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher
from langchain_core.tools import tool
from config import settings

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PHOTO_BASE = "https://places.googleapis.com/v1"

PRICE_LEVEL_MAP = {
    "PRICE_LEVEL_FREE":           "Free",
    "PRICE_LEVEL_INEXPENSIVE":    "£",
    "PRICE_LEVEL_MODERATE":       "££",
    "PRICE_LEVEL_EXPENSIVE":      "£££",
    "PRICE_LEVEL_VERY_EXPENSIVE": "££££",
}


def _get_photo_url(photo_name: str, max_width: int = 1200) -> str | None:
    if not photo_name:
        return None
    try:
        url = f"{PHOTO_BASE}/{photo_name}/media"
        r = requests.get(
            url,
            params={"maxWidthPx": max_width, "key": settings.google_places_api_key, "skipHttpRedirect": "false"},
            allow_redirects=True,
            timeout=5,
        )
        return r.url
    except Exception:
        return None


def _resolve_all_photos(photo_names: list[str]) -> list[str]:
    """Resolve a flat list of photo names to URLs in parallel."""
    if not photo_names:
        return []
    with ThreadPoolExecutor(max_workers=min(12, len(photo_names))) as executor:
        urls = list(executor.map(_get_photo_url, photo_names))
    return [u for u in urls if u]


def _normalize_text(value: str | None) -> str:
    return "".join(ch.lower() if ch.isalnum() else " " for ch in (value or "")).strip()


def _shape_place_results(places: list[dict], category: str, photos_per_place: int) -> list[dict]:
    per_place_names: list[list[str]] = [
        [p["name"] for p in (place.get("photos") or [])[:photos_per_place]]
        for place in places
    ]
    flat_names = [n for names in per_place_names for n in names]
    flat_urls = _resolve_all_photos(flat_names)

    per_place_urls: list[list[str]] = []
    cursor = 0
    for names in per_place_names:
        k = len(names)
        per_place_urls.append(flat_urls[cursor : cursor + k])
        cursor += k

    results = []
    for place, photo_urls in zip(places, per_place_urls):
        photo_url = photo_urls[0] if photo_urls else None

        raw_reviews = place.get("reviews", [])
        reviews = []
        for r in raw_reviews[:5]:
            text = (r.get("text") or {}).get("text", "").strip()
            if not text:
                continue
            reviews.append({
                "author": (r.get("authorAttribution") or {}).get("displayName", "Anonymous"),
                "author_photo": (r.get("authorAttribution") or {}).get("photoUri"),
                "rating": r.get("rating"),
                "text": text,
                "relative_time": r.get("relativePublishTimeDescription", ""),
            })

        results.append({
            "name": place["displayName"]["text"],
            "category": category,
            "rating": place.get("rating"),
            "price_level": PRICE_LEVEL_MAP.get(place.get("priceLevel", ""), None),
            "lat": place["location"]["latitude"],
            "lng": place["location"]["longitude"],
            "address": place.get("formattedAddress", ""),
            "open_now": place.get("regularOpeningHours", {}).get("openNow"),
            "summary": place.get("editorialSummary", {}).get("text"),
            "photo_url": photo_url,
            "photo_urls": photo_urls,
            "reviews": reviews,
        })
    return results


def _google_text_search(text_query: str, category: str, max_results: int, photos_per_place: int) -> list[dict]:
    response = requests.post(
        SEARCH_URL,
        headers={
            "X-Goog-Api-Key": settings.google_places_api_key,
            "X-Goog-FieldMask": (
                "places.displayName,places.rating,places.priceLevel,"
                "places.location,places.regularOpeningHours,"
                "places.photos,places.editorialSummary,places.formattedAddress,"
                "places.reviews"
            ),
        },
        json={"textQuery": text_query, "maxResultCount": max_results},
        timeout=10,
    )
    response.raise_for_status()
    places = response.json().get("places", [])
    return _shape_place_results(places, category, photos_per_place)


def search_places_core(city: str, category: str = "attractions", max_results: int = 6, photos_per_place: int = 3) -> list[dict]:
    """Pure function — callable from both the @tool wrapper and HTTP endpoints.
    photos_per_place: how many photo variants to fetch per place (default 3 for carousel;
    pass 1 for faster grid listings where only the hero photo is needed)."""
    try:
        results = _google_text_search(f"top {category} in {city}", category, max_results, photos_per_place)
        return results if results else [{"error": f"No {category} found in {city}."}]

    except requests.Timeout:
        return [{"error": "Places search timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Places search failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]


def lookup_place_core(query: str, city: str, category: str = "attractions", max_results: int = 5, photos_per_place: int = 3) -> list[dict]:
    """Targeted place lookup used when an itinerary stop needs to be upgraded into a real place."""
    try:
        text_query = f"{query} in {city}".strip()
        results = _google_text_search(text_query, category, max_results, photos_per_place)
        if not results:
            return [{"error": f"No place match found for {query} in {city}."}]

        normalized_query = _normalize_text(query)
        for result in results:
            name = _normalize_text(result.get("name"))
            address = _normalize_text(result.get("address"))
            name_score = SequenceMatcher(None, normalized_query, name).ratio() if normalized_query and name else 0.0
            address_score = SequenceMatcher(None, normalized_query, address).ratio() if normalized_query and address else 0.0
            containment_score = 1.0 if normalized_query and (normalized_query in name or name in normalized_query) else 0.0
            result["match_score"] = round(max(name_score, address_score * 0.8, containment_score), 3)

        results.sort(key=lambda item: item.get("match_score", 0), reverse=True)
        return results

    except requests.Timeout:
        return [{"error": "Place lookup timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Place lookup failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]


@tool
def search_places(city: str, category: str = "attractions") -> list[dict]:
    """Search for any kind of place, business, attraction, or service in a city using Google Places.

    The category is a free-text query — pass any descriptive term that matches what the
    user is looking for. Examples:
      • Trip planning: 'attractions', 'restaurants', 'activities', 'cafes', 'museums', 'beaches'
      • Services / lookups: 'car rental', 'pharmacies', 'banks', 'hospitals', 'supermarkets',
        'gas stations', 'laundromats', 'shopping malls', 'parking garages'
      • Specific cuisines: 'pizza', 'sushi', 'vegan restaurants', 'rooftop bars'

    Returns up to 6 places with name, rating, coordinates, address, and photo URL."""
    return search_places_core(city, category, max_results=6, photos_per_place=3)
