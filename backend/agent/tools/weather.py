import requests
from datetime import date, datetime, timedelta
from collections import defaultdict
from langchain_core.tools import tool
from config import settings

FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

ICON_MAP = {
    "Clear": "☀️",
    "Clouds": "☁️",
    "Rain": "🌧️",
    "Drizzle": "🌦️",
    "Thunderstorm": "⛈️",
    "Snow": "❄️",
    "Mist": "🌫️",
    "Fog": "🌫️",
    "Haze": "🌫️",
}


@tool
def get_weather_forecast(city: str, start_date: str, end_date: str) -> list[dict]:
    """Get weather forecast for a city over a date range.
    start_date and end_date must be 'YYYY-MM-DD'. Forecast is available up to 5 days ahead.
    Returns daily forecast with temperature highs/lows, conditions, and precipitation probability."""
    try:
        response = requests.get(
            FORECAST_URL,
            params={
                "q": city,
                "appid": settings.openweather_api_key,
                "units": "metric",
                "cnt": 40,
            },
            timeout=10,
        )
        response.raise_for_status()
        forecasts = response.json().get("list", [])

        # Group 3-hourly slots by date
        by_day: dict[str, list] = defaultdict(list)
        for slot in forecasts:
            day = slot["dt_txt"][:10]
            by_day[day].append(slot)

        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        results = []

        current = start
        while current <= end:
            day_str = current.isoformat()
            slots = by_day.get(day_str, [])
            if slots:
                temps = [s["main"]["temp"] for s in slots]
                pop = max(s.get("pop", 0) for s in slots)
                main_condition = slots[len(slots) // 2]["weather"][0]["main"]
                description = slots[len(slots) // 2]["weather"][0]["description"].title()
                results.append({
                    "date": day_str,
                    "temp_high_c": round(max(temps), 1),
                    "temp_low_c": round(min(temps), 1),
                    "condition": description,
                    "weather_icon": ICON_MAP.get(main_condition, "🌡️"),
                    "precipitation_probability": round(pop * 100),
                })
            current += timedelta(days=1)

        return results if results else [{"error": "No forecast data available for the selected dates. Forecast is limited to 5 days ahead."}]

    except requests.Timeout:
        return [{"error": "Weather forecast request timed out. Try again."}]
    except requests.HTTPError as e:
        return [{"error": f"Weather forecast failed: {str(e)}"}]
    except Exception as e:
        return [{"error": f"Unexpected error: {str(e)}"}]
