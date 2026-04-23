import requests
from langchain_core.tools import tool


@tool
def get_country_info(country: str) -> dict:
    """Get practical travel information for a country including language, currency,
    timezone, emergency calling code, driving side, and population."""
    try:
        response = requests.get(
            f"https://restcountries.com/v3.1/name/{country}",
            params={"fields": "name,capital,languages,currencies,region,subregion,flags,timezones,idd,population,car"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()[0]

        languages = list(data.get("languages", {}).values())
        currencies_raw = data.get("currencies", {})
        currencies = [
            {"code": code, "name": info["name"], "symbol": info.get("symbol", "")}
            for code, info in currencies_raw.items()
        ]

        # Build calling code e.g. +34
        idd = data.get("idd", {})
        root = idd.get("root", "")
        suffixes = idd.get("suffixes", [])
        calling_code = root + (suffixes[0] if len(suffixes) == 1 else "")

        # Timezone — first entry, strip "UTC" prefix for readability
        timezones = data.get("timezones", [])
        timezone = timezones[0] if timezones else ""

        population = data.get("population", 0)
        pop_str = f"{population / 1_000_000:.1f}M" if population >= 1_000_000 else f"{population:,}"

        car = data.get("car", {})
        driving_side = car.get("side", "right").capitalize()

        return {
            "name": data["name"]["common"],
            "capital": data.get("capital", ["Unknown"])[0],
            "region": data.get("region", ""),
            "subregion": data.get("subregion", ""),
            "languages": languages,
            "currencies": currencies,
            "flag": data.get("flags", {}).get("emoji", ""),
            "timezone": timezone,
            "calling_code": calling_code,
            "population": pop_str,
            "driving_side": driving_side,
        }
    except requests.Timeout:
        return {"error": "Country info request timed out. Try again."}
    except (requests.HTTPError, IndexError):
        return {"error": f"Could not find country info for '{country}'."}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
