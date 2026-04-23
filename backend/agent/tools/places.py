import requests
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


def _get_photo_url(photo_name: str, max_width: int = 400) -> str | None:
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


@tool
def search_places(city: str, category: str = "attractions") -> list[dict]:
    """Search for points of interest, activities, and restaurants in a city using Google Places.
    category can be 'attractions', 'restaurants', or 'activities'.
    Returns up to 6 places with name, rating, coordinates, summary, and photo URL."""
    try:
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
            json={"textQuery": f"top {category} in {city}", "maxResultCount": 6},
            timeout=10,
        )
        response.raise_for_status()
        places = response.json().get("places", [])

        results = []
        for place in places:
            photos = place.get("photos", [])
            photo_names = [p["name"] for p in photos[:3]]
            photo_urls = [u for u in (_get_photo_url(n) for n in photo_names) if u]
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
        return results if results else [{"error": f"No {category} found in {city}."}]

    except requests.Timeout:
        return [{"error": "Places search timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Places search failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]
