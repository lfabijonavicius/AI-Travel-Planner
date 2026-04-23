import time
import requests
from langchain_core.tools import tool
from config import settings

HOST = "booking-com.p.rapidapi.com"
HEADERS = {
    "X-RapidAPI-Key": settings.rapidapi_key,
    "X-RapidAPI-Host": HOST,
}


@tool
def search_hotels(
    city: str,
    check_in: str,
    check_out: str,
    guests: int = 2,
    max_results: int = 4,
) -> list[dict]:
    """Search for available hotels in a city for given dates.
    check_in and check_out must be 'YYYY-MM-DD'.
    Returns hotels with name, star rating, price per night, photo URL, and booking URL."""
    try:
        from datetime import date as _date
        today = _date.today()
        if _date.fromisoformat(check_in) < today:
            return [{"error": f"check_in date {check_in} is in the past. Use today ({today}) or a future date."}]

        # Step 1: resolve city to dest_id
        loc_resp = requests.get(
            f"https://{HOST}/v1/hotels/locations",
            headers=HEADERS,
            params={"locale": "en-gb", "name": city},
            timeout=10,
        )
        loc_resp.raise_for_status()
        locations = loc_resp.json()
        dest = next(
            (l for l in locations if l.get("dest_type") in ("city", "ci")),
            locations[0] if locations else None,
        )
        if not dest:
            return [{"error": f"Could not find destination '{city}'."}]

        dest_id = dest["dest_id"]
        dest_type = dest.get("dest_type", "city")

        time.sleep(0.5)  # stay within free-tier rate limit

        # Step 2: search hotels
        search_resp = requests.get(
            f"https://{HOST}/v1/hotels/search",
            headers=HEADERS,
            params={
                "dest_id": dest_id,
                "dest_type": dest_type,
                "checkin_date": check_in,
                "checkout_date": check_out,
                "adults_number": guests,
                "room_number": 1,
                "units": "metric",
                "filter_by_currency": "GBP",
                "locale": "en-gb",
                "order_by": "popularity",
                "page_number": 0,
                "include_adjacency": "true",
            },
            timeout=15,
        )
        search_resp.raise_for_status()
        hotels = search_resp.json().get("result", [])[:max_results]

        nights = _nights(check_in, check_out)
        results = []
        for h in hotels:
            total = h.get("min_total_price") or 0
            currency = h.get("currencycode", "EUR")
            photo = h.get("max_photo_url") or h.get("main_photo_url") or ""
            # Use direct booking URL from result
            booking_url = h.get("url") or f"https://www.booking.com/searchresults.html?ss={city}&checkin={check_in}&checkout={check_out}&group_adults={guests}"
            lat = h.get("latitude")
            lng = h.get("longitude")
            entry = {
                "name": h.get("hotel_name", "Unknown"),
                "stars": int(h.get("class", 0) or 0),
                "review_score": h.get("review_score"),
                "review_word": h.get("review_score_word", ""),
                "price_per_night_gbp": round(total / nights) if nights else round(total),
                "total_price_gbp": round(total),
                "currency": currency,
                "address": h.get("address", ""),
                "city": city,
                "photo_url": photo,
                "booking_url": booking_url,
            }
            if lat is not None and lng is not None:
                entry["lat"] = float(lat)
                entry["lng"] = float(lng)
            results.append(entry)

        return results if results else [{"error": "No hotels found for these dates."}]

    except requests.Timeout:
        return [{"error": "Hotel search timed out. Try again."}]
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            return [{"error": "Hotel API rate limit reached. Do not retry — continue with other tools."}]
        return [{"error": f"Hotel search failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]


def _nights(check_in: str, check_out: str) -> int:
    from datetime import date
    try:
        return max(1, (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days)
    except Exception:
        return 1
