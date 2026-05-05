import requests
from difflib import SequenceMatcher
import unicodedata

from config import settings

TRIPADVISOR_BASE_URL = "https://api.tripadvisor.com/api/partner/2.0"


def has_tripadvisor_key() -> bool:
    return bool(settings.tripadvisor_api_key.strip())


def _normalize_category(category: str) -> str:
    normalized = (category or "attractions").strip().lower()
    if normalized in {"restaurants", "restaurant", "food"}:
        return "restaurants"
    if normalized in {"hotels", "hotel", "accommodation", "accommodations"}:
        return "hotels"
    return "attractions"


def _mapper_key() -> str:
    return f"{settings.tripadvisor_api_key.strip()}-mapper"


def _normalize(text: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else " " for ch in (text or "")).strip()


def _ascii_fold(text: str) -> str:
    return unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")


def _query_variants(query: str) -> list[str]:
    variants: list[str] = []
    raw = (query or "").strip()
    folded = _ascii_fold(raw).strip()
    for value in (raw, folded):
        if value and value not in variants:
            variants.append(value)
    return variants


def _name_score(query: str, candidate: str) -> float:
    q = " ".join(_normalize(query).split())
    c = " ".join(_normalize(candidate).split())
    if not q or not c:
        return 0.0
    if q == c:
        return 1.0
    if q in c or c in q:
        return 0.9
    return SequenceMatcher(None, q, c).ratio()


def map_location(lat: float, lng: float, query: str, category: str = "attractions") -> dict:
    if not has_tripadvisor_key():
        return {"error": "Tripadvisor API key is missing."}

    for variant in _query_variants(query):
        response = requests.get(
            f"{TRIPADVISOR_BASE_URL}/location_mapper/{lat},{lng}",
            params={
                "key": _mapper_key(),
                "category": _normalize_category(category),
                "q": variant,
            },
            timeout=12,
        )
        response.raise_for_status()
        data = response.json().get("data", [])
        if data:
            return data[0]
    return {"error": "No Tripadvisor mapping candidates found."}


def map_location_candidates(lat: float, lng: float, query: str, category: str = "attractions") -> list[dict] | dict:
    if not has_tripadvisor_key():
        return {"error": "Tripadvisor API key is missing."}

    for variant in _query_variants(query):
        response = requests.get(
            f"{TRIPADVISOR_BASE_URL}/location_mapper/{lat},{lng}",
            params={
                "key": _mapper_key(),
                "category": _normalize_category(category),
                "q": variant,
            },
            timeout=12,
        )
        response.raise_for_status()
        data = response.json().get("data", [])
        if data:
            return data
    return {"error": "No Tripadvisor mapping candidates found."}


def get_location_details(location_id: str, lang: str = "en_US", currency: str = "GBP") -> dict:
    if not has_tripadvisor_key():
        return {"error": "Tripadvisor API key is missing."}

    response = requests.get(
        f"{TRIPADVISOR_BASE_URL}/location/{location_id}",
        params={
            "key": settings.tripadvisor_api_key.strip(),
            "lang": lang,
            "currency": currency,
        },
        timeout=12,
    )
    response.raise_for_status()
    return response.json()


def lookup_location(lat: float, lng: float, query: str, category: str = "attractions") -> dict:
    try:
        mapped = map_location(lat=lat, lng=lng, query=query, category=category)
        if mapped.get("error"):
            return mapped

        location_id = str(mapped.get("location_id", "")).strip()
        if not location_id:
            return {"error": "Tripadvisor mapper returned no location_id.", "mapper": mapped}

        details = get_location_details(location_id)
        if details.get("error"):
            return {"error": details["error"], "mapper": mapped}

        return {
            "mapper": mapped,
            "details": details,
        }
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        body = exc.response.text[:500] if exc.response is not None else ""
        return {
            "error": f"Tripadvisor request failed with HTTP {status}.",
            "response_body": body,
        }
    except requests.Timeout:
        return {"error": "Tripadvisor request timed out."}
    except Exception as exc:
        return {"error": f"Tripadvisor lookup failed: {str(exc)}"}


def enrich_location(lat: float, lng: float, query: str, category: str = "attractions") -> dict:
    try:
        candidates = map_location_candidates(lat=lat, lng=lng, query=query, category=category)
        if isinstance(candidates, dict):
            return candidates

        ranked = sorted(
            [
                {
                    **candidate,
                    "match_score": round(_name_score(query, str(candidate.get("name", ""))), 4),
                }
                for candidate in candidates[:8]
            ],
            key=lambda item: item["match_score"],
            reverse=True,
        )
        best = ranked[0] if ranked else None
        if not best:
            return {"error": "No Tripadvisor mapping candidates found."}

        score = float(best.get("match_score", 0.0))
        if score < 0.72:
            return {
                "matched": False,
                "query": query,
                "category": _normalize_category(category),
                "best_candidate": best,
                "candidates": ranked[:3],
                "reason": "No strong Tripadvisor name match.",
            }

        details = get_location_details(str(best["location_id"]))
        return {
            "matched": True,
            "query": query,
            "category": _normalize_category(category),
            "match_score": score,
            "best_candidate": best,
            "candidates": ranked[:3],
            "details": {
                "location_id": details.get("location_id"),
                "name": details.get("name"),
                "rating": details.get("rating"),
                "num_reviews": details.get("num_reviews"),
                "ranking_string": (details.get("ranking_data") or {}).get("ranking_string"),
                "price_level": details.get("price_level"),
                "trip_types": details.get("trip_types") or [],
                "awards": details.get("awards") or [],
                "web_url": details.get("web_url"),
                "write_review": details.get("write_review"),
                "description": details.get("description"),
                "reviews": details.get("reviews") or [],
                "subratings": details.get("subratings") or [],
                "photo_count": details.get("photo_count"),
                "see_all_photos": details.get("see_all_photos"),
                "hotel_booking": details.get("hotel_booking") or {},
                "category": (details.get("category") or {}).get("localized_name"),
                "subcategory": details.get("subcategory") or [],
                "address_string": (details.get("address_obj") or {}).get("address_string"),
            },
        }
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        body = exc.response.text[:500] if exc.response is not None else ""
        return {
            "error": f"Tripadvisor request failed with HTTP {status}.",
            "response_body": body,
        }
    except requests.Timeout:
        return {"error": "Tripadvisor request timed out."}
    except Exception as exc:
        return {"error": f"Tripadvisor enrichment failed: {str(exc)}"}
