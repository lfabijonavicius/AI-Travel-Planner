import requests
from datetime import date
from langchain_core.tools import tool
from config import settings

# Travelpayouts v1 calendar prices API — returns real flights with airline + departure times
CALENDAR_URL = "https://api.travelpayouts.com/v1/prices/calendar"

AIRPORT_TO_CITY = {
    "LHR": "LON", "LGW": "LON", "STN": "LON", "LTN": "LON",
    "CDG": "PAR", "ORY": "PAR",
    "JFK": "NYC", "EWR": "NYC", "LGA": "NYC",
    "HND": "TYO", "NRT": "TYO",
    "FCO": "ROM", "MXP": "MIL",
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
        orig = AIRPORT_TO_CITY.get(origin.upper(), origin.upper())
        dest = AIRPORT_TO_CITY.get(destination.upper(), destination.upper())

        dep = date.fromisoformat(departure_date)
        if dep < date.today():
            return [{"error": f"departure_date {departure_date} is in the past. Use today or a future date."}]

        ret = date.fromisoformat(return_date)
        trip_length = max(1, (ret - dep).days)

        response = requests.get(
            CALENDAR_URL,
            headers={"X-Access-Token": settings.travelpayouts_api_key},
            params={
                "origin": orig,
                "destination": dest,
                "depart_date": departure_date[:7],  # YYYY-MM
                "currency": "GBP",
                "calendar_type": "departure_date",
                "length": trip_length,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        flights_by_date = data.get("data", {})
        if not flights_by_date:
            return [{"error": f"No flights found from {orig} to {dest} in {departure_date[:7]}. The route may not be cached yet."}]

        # Sort by price, take top 3
        flights_raw = sorted(flights_by_date.values(), key=lambda f: f.get("price", 9999))[:3]

        results = []
        for f in flights_raw:
            airline_code = f.get("airline", "")
            dep_at = f.get("departure_at", "")
            ret_at = f.get("return_at", "")
            results.append({
                "airline": AIRLINE_NAMES.get(airline_code, airline_code),
                "airline_code": airline_code,
                "flight_number": f"{airline_code}{f.get('flight_number', '')}",
                "origin": orig,
                "destination": dest,
                "departure_date": dep_at[:10] if dep_at else departure_date,
                "departure_time": _fmt_time(dep_at),
                "return_date": ret_at[:10] if ret_at else return_date,
                "stops": f.get("transfers", 0),
                "price_gbp": round(f.get("price", 0)),
                "cabin": "economy",
                "booking_url": _build_booking_url(orig, dest, departure_date, return_date, adults),
            })

        return results

    except requests.Timeout:
        return [{"error": "Flight search timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Flight search failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]


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
