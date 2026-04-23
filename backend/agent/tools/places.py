import requests
from langchain_core.tools import tool
from config import settings

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PHOTO_BASE = "https://places.googleapis.com/v1"


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
                    "places.photos,places.editorialSummary,places.formattedAddress"
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
            photo_url = _get_photo_url(photos[0]["name"]) if photos else None
            results.append({
                "name": place["displayName"]["text"],
                "category": category,
                "rating": place.get("rating"),
                "price_level": place.get("priceLevel"),
                "lat": place["location"]["latitude"],
                "lng": place["location"]["longitude"],
                "address": place.get("formattedAddress", ""),
                "open_now": place.get("regularOpeningHours", {}).get("openNow"),
                "summary": place.get("editorialSummary", {}).get("text"),
                "photo_url": photo_url,
            })
        return results if results else [{"error": f"No {category} found in {city}."}]

    except requests.Timeout:
        return [{"error": "Places search timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Places search failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]
