import requests
from datetime import date, timedelta
from langchain_core.tools import tool
from config import settings

# Travelpayouts v1 calendar prices API — returns real flights with airline + departure times
CALENDAR_URL = "https://api.travelpayouts.com/v1/prices/calendar"
AERODATABOX_URL = "https://aerodatabox.p.rapidapi.com"

# Direct booking URLs for airlines not in GDS (LCCs)
AIRLINE_BOOKING_URLS: dict[str, str] = {
    "U2": "https://www.easyjet.com",
    "EZY": "https://www.easyjet.com",
    "FR": "https://www.ryanair.com",
    "RK": "https://www.ryanair.com",
    "RUK": "https://www.ryanair.com",
    "LS": "https://www.jet2.com",
    "EXS": "https://www.jet2.com",
    "BY": "https://www.tui.co.uk",
    "TOM": "https://www.tui.co.uk",
    "W6": "https://wizzair.com",
    "WZZ": "https://wizzair.com",
    "W9": "https://wizzair.com",
    "BA": "https://www.britishairways.com",
    "LH": "https://www.lufthansa.com",
    "AF": "https://www.airfrance.com",
    "KL": "https://www.klm.com",
    "IB": "https://www.iberia.com",
    "VY": "https://www.vueling.com",
    "EW": "https://www.eurowings.com",
    "TK": "https://www.turkishairlines.com",
    "EK": "https://www.emirates.com",
    "QR": "https://www.qatarairways.com",
}

AIRPORT_TO_CITY = {
    "LHR": "LON", "LGW": "LON", "STN": "LON", "LTN": "LON",
    "CDG": "PAR", "ORY": "PAR",
    "JFK": "NYC", "EWR": "NYC", "LGA": "NYC",
    "HND": "TYO", "NRT": "TYO",
    "FCO": "ROM", "MXP": "MIL",
}

CITY_TO_AIRPORTS: dict[str, list[str]] = {}
for airport_code, city_code in AIRPORT_TO_CITY.items():
    CITY_TO_AIRPORTS.setdefault(city_code, []).append(airport_code)

LIKELY_CONNECTION_HUBS = {
    "JTR": ["ATH"],
    "HER": ["ATH"],
    "CHQ": ["ATH"],
    "RHO": ["ATH"],
    "CFU": ["ATH"],
    "KEF": ["LHR", "CPH"],
}

AIRLINE_NAMES = {
    "SU": "Aeroflot", "BA": "British Airways", "LH": "Lufthansa",
    "JL": "Japan Airlines", "NH": "ANA", "EK": "Emirates",
    "QR": "Qatar Airways", "TK": "Turkish Airlines", "AF": "Air France",
    "KL": "KLM", "IB": "Iberia", "FR": "Ryanair", "U2": "easyJet",
    "VS": "Virgin Atlantic", "AA": "American Airlines", "UA": "United",
    "DL": "Delta", "CX": "Cathay Pacific", "SQ": "Singapore Airlines",
    "QF": "Qantas", "CZ": "China Southern", "MU": "China Eastern",
    "WY": "Oman Air", "W9": "Wizz Air",
    "CA": "Air China", "ZH": "Shenzhen Airlines", "MH": "Malaysia Airlines",
    "OZ": "Asiana Airlines", "KE": "Korean Air", "CI": "China Airlines",
}


@tool
def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str,
    adults: int = 2,
) -> list[dict]:
    """Search for available flights between two cities on given dates.
    origin and destination should be IATA city or airport codes (e.g. 'LON', 'TYO', 'LHR', 'HND').
    departure_date and return_date must be 'YYYY-MM-DD'.
    Returns up to 3 flight options with airline, price in GBP, departure time, stops, and booking URL."""
    try:
        requested_origin = origin.upper()
        requested_destination = destination.upper()
        orig = AIRPORT_TO_CITY.get(requested_origin, requested_origin)
        dest = AIRPORT_TO_CITY.get(requested_destination, requested_destination)

        dep = date.fromisoformat(departure_date)
        if dep < date.today():
            return [_build_advice_result(
                orig,
                dest,
                departure_date,
                "Choose future travel dates",
                f"{departure_date} is in the past, so live fares cannot be checked for that departure.",
                "Try a date from today onward and Voyager can compare exact or slightly shifted options.",
            )]

        ret = date.fromisoformat(return_date)
        trip_length = max(1, (ret - dep).days)
        search_pairs = _build_search_pairs(requested_origin, requested_destination)
        month_keys = [departure_date[:7]]

        all_flights = _collect_flights(
            search_pairs,
            month_keys,
            dep,
            trip_length,
            adults,
        )

        if not _has_close_match(all_flights):
            month_keys = _expand_month_keys(dep)
            all_flights = _collect_flights(
                search_pairs,
                month_keys,
                dep,
                trip_length,
                adults,
            )

        if not all_flights:
            operators = _fetch_route_operators(requested_origin, requested_destination)
            if operators:
                title = "Route confirmed — book direct with the airline"
                summary = f"Voyager found {len(operators)} airline{'s' if len(operators) != 1 else ''} flying {orig} → {dest}. These are low-cost carriers not listed in fare aggregators — book directly on their sites."
                details = "Prices are not available through Voyager's fare feed for this route. Click an airline below to search and book on their site."
            else:
                title = "No indexed fare landed on the exact route yet"
                summary = f"Voyager could not find a published fare from {orig} to {dest} around {departure_date}."
                details = "This route often works better with a one-stop connection or a 1-3 day shift, so the next best move is to try nearby airport variants or flexible dates."
            return [_build_advice_result(
                orig,
                dest,
                departure_date,
                title,
                summary,
                details,
                suggested_origins=_suggested_origins(requested_origin, orig),
                suggested_dates=_suggested_dates(dep),
                suggested_hubs=LIKELY_CONNECTION_HUBS.get(dest, []),
                confirmed_operators=operators,
            )]

        return _pick_best_options(all_flights)

    except requests.Timeout:
        return [_build_advice_result(
            orig,
            dest,
            departure_date,
            "Flight search timed out",
            "The live fare feed took too long to respond this time.",
            "Try again in a moment and Voyager will re-check exact dates, nearby dates, and alternative airports.",
        )]
    except requests.HTTPError as e:
        return [_build_advice_result(
            orig,
            dest,
            departure_date,
            "Flight prices are temporarily unavailable",
            f"The fare feed returned an error while checking {orig} to {dest}.",
            f"Technical detail: {str(e)}",
        )]
    except Exception as e:
        return [_build_advice_result(
            orig,
            dest,
            departure_date,
            "Flight search hit an unexpected issue",
            f"Voyager could not finish checking fares from {orig} to {dest}.",
            f"Technical detail: {str(e)}",
        )]


def _build_search_pairs(origin: str, destination: str) -> list[tuple[str, str]]:
    origin_variants = _code_variants(origin)
    destination_variants = _code_variants(destination)
    pairs: list[tuple[str, str]] = []
    for orig in origin_variants:
        for dest in destination_variants:
            if (orig, dest) not in pairs:
                pairs.append((orig, dest))
    return pairs[:10]


def _code_variants(code: str) -> list[str]:
    requested = code.upper()
    normalized_city = AIRPORT_TO_CITY.get(requested, requested)
    variants: list[str] = []
    if len(requested) == 3 and requested in AIRPORT_TO_CITY:
        variants.append(requested)
    variants.append(normalized_city)
    for airport_code in CITY_TO_AIRPORTS.get(normalized_city, []):
        if airport_code not in variants:
            variants.append(airport_code)
    return variants


def _collect_flights(
    search_pairs: list[tuple[str, str]],
    month_keys: list[str],
    requested_departure: date,
    trip_length: int,
    adults: int,
) -> list[dict]:
    flights: list[dict] = []
    seen: set[tuple[str, str, str, int, str]] = set()
    for origin_code, destination_code in search_pairs:
        for month_key in month_keys:
            for raw in _fetch_calendar(origin_code, destination_code, month_key, trip_length):
                normalized = _normalize_flight_result(
                    raw,
                    origin_code,
                    destination_code,
                    requested_departure,
                    trip_length,
                    adults,
                )
                dedupe_key = (
                    normalized["origin"],
                    normalized["destination"],
                    normalized["departure_date"],
                    normalized["price_gbp"],
                    normalized["airline_code"],
                )
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                flights.append(normalized)
    return flights


def _fetch_calendar(origin: str, destination: str, depart_month: str, trip_length: int) -> list[dict]:
    try:
        response = requests.get(
            CALENDAR_URL,
            headers={"X-Access-Token": settings.travelpayouts_api_key},
            params={
                "origin": origin,
                "destination": destination,
                "depart_date": depart_month,
                "currency": "GBP",
                "calendar_type": "departure_date",
                "length": trip_length,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        flights_by_date = data.get("data", {})
    except requests.RequestException:
        return []
    if not flights_by_date:
        return []
    return sorted(flights_by_date.values(), key=lambda item: item.get("price", 999999))


def _normalize_flight_result(
    raw: dict,
    origin: str,
    destination: str,
    requested_departure: date,
    trip_length: int,
    adults: int,
) -> dict:
    airline_code = raw.get("airline", "")
    dep_at = raw.get("departure_at", "")
    ret_at = raw.get("return_at", "")
    departure_date = dep_at[:10] if dep_at else requested_departure.isoformat()
    try:
        departure_day = date.fromisoformat(departure_date)
    except Exception:
        departure_day = requested_departure
    adjustment_days = (departure_day - requested_departure).days
    return_date = ret_at[:10] if ret_at else (departure_day + timedelta(days=trip_length)).isoformat()
    stops = int(raw.get("transfers", 0) or 0)
    match_type = "exact" if adjustment_days == 0 else "nearby"

    return {
        "kind": "flight",
        "airline": AIRLINE_NAMES.get(airline_code, airline_code),
        "airline_code": airline_code,
        "flight_number": f"{airline_code}{raw.get('flight_number', '')}",
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
        "departure_time": _fmt_time(dep_at),
        "return_date": return_date,
        "stops": stops,
        "price_gbp": round(raw.get("price", 0)),
        "cabin": "economy",
        "booking_url": _build_booking_url(origin, destination, departure_date, return_date, adults),
        "matches_requested_dates": adjustment_days == 0,
        "date_adjustment_days": adjustment_days,
        "option_label": _option_label(adjustment_days, match_type),
        "note": _note_for_option(adjustment_days, stops),
    }


def _has_close_match(flights: list[dict]) -> bool:
    return any(abs(f.get("date_adjustment_days", 999)) <= 3 for f in flights)


def _expand_month_keys(requested_departure: date) -> list[str]:
    current_month = requested_departure.replace(day=1)
    previous_month = (current_month - timedelta(days=1)).replace(day=1)
    next_month = (current_month + timedelta(days=32)).replace(day=1)
    return [current_month.isoformat()[:7], previous_month.isoformat()[:7], next_month.isoformat()[:7]]


def _pick_best_options(flights: list[dict]) -> list[dict]:
    # Primary sort: cheapest direct, then cheapest with stops, within ±7 days of requested date
    sorted_by_fit = sorted(
        flights,
        key=lambda flight: (
            flight.get("stops", 9),
            flight.get("price_gbp", 999999),
            abs(flight.get("date_adjustment_days", 999)),
        ),
    )
    exact = [flight for flight in sorted_by_fit if flight.get("matches_requested_dates")]
    close_flex = [
        flight
        for flight in sorted_by_fit
        if not flight.get("matches_requested_dates") and abs(flight.get("date_adjustment_days", 999)) <= 3
    ]
    cheap_flex = sorted(
        [flight for flight in sorted_by_fit if abs(flight.get("date_adjustment_days", 999)) <= 7],
        key=lambda flight: (flight.get("stops", 9), flight.get("price_gbp", 999999), abs(flight.get("date_adjustment_days", 999))),
    )

    picks: list[dict] = []
    for candidate in exact[:1] + close_flex[:2] + cheap_flex[:2] + sorted_by_fit[:3]:
        if not candidate:
            continue
        if any(
            existing["departure_date"] == candidate["departure_date"]
            and existing["origin"] == candidate["origin"]
            and existing["destination"] == candidate["destination"]
            and existing["price_gbp"] == candidate["price_gbp"]
            for existing in picks
        ):
            continue
        picks.append(candidate)
        if len(picks) == 3:
            break
    return picks


def _option_label(adjustment_days: int, match_type: str) -> str:
    if match_type == "exact":
        return "Requested dates"
    if adjustment_days > 0:
        return f"+{adjustment_days} day" if adjustment_days == 1 else f"+{adjustment_days} days"
    if adjustment_days < 0:
        return f"{adjustment_days} day" if adjustment_days == -1 else f"{adjustment_days} days"
    return "Nearby dates"


def _note_for_option(adjustment_days: int, stops: int) -> str:
    parts: list[str] = []
    if adjustment_days > 0:
        parts.append(f"leave {adjustment_days} day{'s' if adjustment_days != 1 else ''} later")
    elif adjustment_days < 0:
        parts.append(f"leave {abs(adjustment_days)} day{'s' if adjustment_days != -1 else ''} earlier")
    if stops > 0:
        parts.append(f"{stops} stop{'s' if stops != 1 else ''}")
    return ", ".join(parts)


def _suggested_origins(requested_origin: str, normalized_origin: str) -> list[str]:
    variants = [code for code in _code_variants(requested_origin) if code != normalized_origin]
    if requested_origin != normalized_origin and requested_origin not in variants:
        variants.insert(0, requested_origin)
    return variants[:4]


def _suggested_dates(requested_departure: date) -> list[str]:
    offsets = (-3, -1, 1, 3)
    return [(requested_departure + timedelta(days=offset)).isoformat() for offset in offsets]


def _fetch_route_operators(origin_iata: str, dest_iata: str) -> list[dict]:
    """Query AeroDataBox for confirmed operators on a route when no priced fares exist."""
    if not settings.aero_data_box:
        return []
    try:
        response = requests.get(
            f"{AERODATABOX_URL}/airports/iata/{origin_iata}/stats/routes/daily",
            headers={
                "X-RapidAPI-Key": settings.aero_data_box,
                "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
            },
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()
        routes = data if isinstance(data, list) else data.get("routes", [])
        for route in routes:
            dest = route.get("destination", {})
            if dest.get("iata", "").upper() == dest_iata.upper():
                operators = []
                for op in route.get("operators", []):
                    iata = op.get("iata", "")
                    icao = op.get("icao", "")
                    booking_url = (
                        AIRLINE_BOOKING_URLS.get(iata)
                        or AIRLINE_BOOKING_URLS.get(icao)
                    )
                    operators.append({
                        "name": op.get("name", iata),
                        "iata": iata,
                        "booking_url": booking_url,
                    })
                return operators
    except Exception:
        pass
    return []


def _build_advice_result(
    origin: str,
    destination: str,
    departure_date: str,
    title: str,
    summary: str,
    details: str,
    *,
    suggested_origins: list[str] | None = None,
    suggested_dates: list[str] | None = None,
    suggested_hubs: list[str] | None = None,
    confirmed_operators: list[dict] | None = None,
) -> dict:
    return {
        "kind": "advice",
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
        "title": title,
        "summary": summary,
        "details": details,
        "suggested_origins": suggested_origins or [],
        "suggested_dates": suggested_dates or [],
        "suggested_hubs": suggested_hubs or [],
        "confirmed_operators": confirmed_operators or [],
    }


def _build_booking_url(origin: str, destination: str, depart: str, ret: str, adults: int) -> str:
    # Aviasales search URL format: {origin}{DDMM}{destination}{DDMM}{pax}
    try:
        dep_ddmm = depart[8:10] + depart[5:7]   # DD + MM
        ret_ddmm = ret[8:10] + ret[5:7]
        return f"https://www.aviasales.com/search/{origin}{dep_ddmm}{destination}{ret_ddmm}{adults}"
    except Exception:
        return "https://www.aviasales.com/"


def _fmt_time(iso_datetime: str) -> str:
    if "T" in iso_datetime:
        return iso_datetime.split("T")[1][:5]
    return ""
