import time
import logging
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_core.tools import tool
from config import settings
from agent.tools.places import _google_text_search

logger = logging.getLogger(__name__)

HOST = "booking-com.p.rapidapi.com"
HEADERS = {
    "X-RapidAPI-Key": settings.rapidapi_key,
    "X-RapidAPI-Host": HOST,
}


def _enrich_hotel_photos(hotel_name: str, city: str, booking_photo: str | None) -> list[str]:
    """Fetch additional hotel photos from Google Places.

    Returns a list of photo URLs, deduplicated, with the Booking.com hero
    photo first (if available). Falls back to whatever exists on error so
    a Google failure never blocks the hotel response.
    """
    photos: list[str] = []
    if booking_photo:
        photos.append(booking_photo)

    try:
        query = f"{hotel_name}, {city}"
        results = _google_text_search(query, "hotel", max_results=1, photos_per_place=5)
        if results and not results[0].get("error"):
            place_photos = results[0].get("photo_urls", []) or []
            for url in place_photos:
                if url and url not in photos:
                    photos.append(url)
    except Exception as e:
        logger.debug(f"Hotel photo enrichment failed for {hotel_name!r}: {e}")

    return photos[:5]  # cap at 5 photos per hotel


@tool
def search_hotels(
    city: str,
    check_in: str,
    check_out: str,
    guests: int = 2,
    max_results: int = 4,
    sort_by: str = "price",
    max_price_per_night_gbp: float | None = None,
) -> list[dict]:
    """Search for available hotels in a city for given dates.
    check_in and check_out must be 'YYYY-MM-DD'.
    sort_by may be 'price' or 'popularity'. max_price_per_night_gbp is optional.
    Returns hotels with name, star rating, price per night, photo gallery, and booking URL."""
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
                "order_by": "price" if str(sort_by).lower() != "popularity" else "popularity",
                "page_number": 0,
                "include_adjacency": "true",
            },
            timeout=15,
        )
        search_resp.raise_for_status()
        hotels = search_resp.json().get("result", [])[: max(max_results * 6, 20)]

        nights = _nights(check_in, check_out)

        # Step 3: build base hotel records (without enriched photos yet)
        base_records: list[dict] = []
        for h in hotels:
            total = h.get("min_total_price") or 0
            currency = h.get("currencycode", "EUR")
            booking_photo = h.get("max_photo_url") or h.get("main_photo_url") or ""
            booking_url = h.get("url") or f"https://www.booking.com/searchresults.html?ss={city}&checkin={check_in}&checkout={check_out}&group_adults={guests}"
            lat = h.get("latitude")
            lng = h.get("longitude")
            entry: dict = {
                "name": h.get("hotel_name", "Unknown"),
                "stars": int(h.get("class", 0) or 0),
                "review_score": h.get("review_score"),
                "review_word": h.get("review_score_word", ""),
                "price_per_night_gbp": round(total / nights) if nights else round(total),
                "total_price_gbp": round(total),
                "currency": currency,
                "address": h.get("address", ""),
                "city": city,
                "photo_url": booking_photo,
                "photo_urls": [booking_photo] if booking_photo else [],
                "booking_url": booking_url,
            }
            if lat is not None and lng is not None:
                entry["lat"] = float(lat)
                entry["lng"] = float(lng)
            base_records.append(entry)

        base_records = [record for record in base_records if record["price_per_night_gbp"] > 0]

        if max_price_per_night_gbp is not None:
            affordable = [
                record for record in base_records
                if record["price_per_night_gbp"] <= max_price_per_night_gbp
            ]
            if affordable:
                base_records = affordable

        if str(sort_by).lower() == "popularity":
            base_records.sort(
                key=lambda record: (
                    -(record.get("review_score") or 0),
                    record["price_per_night_gbp"],
                )
            )
        else:
            base_records.sort(
                key=lambda record: (
                    record["price_per_night_gbp"],
                    -(record.get("review_score") or 0),
                )
            )
        base_records = base_records[:max_results]

        if not base_records:
            return [{"error": "No hotels found for these dates."}]

        # Fetch extra photos for all hotels concurrently — much faster than doing them one by one
        if settings.google_places_api_key:
            with ThreadPoolExecutor(max_workers=min(6, len(base_records))) as executor:
                futures = {
                    executor.submit(
                        _enrich_hotel_photos,
                        record["name"],
                        city,
                        record.get("photo_url") or None,
                    ): index
                    for index, record in enumerate(base_records)
                }
                for future in as_completed(futures, timeout=8):
                    index = futures[future]
                    try:
                        enriched = future.result(timeout=4)
                        if enriched:
                            base_records[index]["photo_urls"] = enriched
                    except Exception as e:
                        logger.debug(f"Photo enrichment timed out for hotel index {index}: {e}")

        return base_records

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
